import React from 'react';
import { motion } from 'motion/react';
import { DocumentItem, ReadingSession, DocumentType } from '../types/document';
import { getTypeBadgeConfig, formatFileSize, formatDateLabel } from '../utils/fileHelpers';

interface HomeScreenProps {
  documents: DocumentItem[];
  recentSession: ReadingSession | null;
  onOpenDocument: (doc: DocumentItem) => void;
  onImportFile: () => void;
  onSelectCategory: (type: DocumentType) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onViewAllFiles: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  documents,
  recentSession,
  onOpenDocument,
  onImportFile,
  onSelectCategory,
  onToggleFavorite,
  onViewAllFiles,
}) => {
  const pdfCount = documents.filter((d) => d.type === 'pdf').length;
  const wordCount = documents.filter((d) => d.type === 'word').length;
  const excelCount = documents.filter((d) => d.type === 'excel').length;
  const slidesCount = documents.filter((d) => d.type === 'powerpoint').length;
  const textCount = documents.filter((d) => d.type === 'text' || d.type === 'markdown').length;

  const recentDocs = documents.slice(0, 5);

  const activeDoc = recentSession
    ? documents.find((d) => d.id === recentSession.documentId) || documents[0]
    : documents[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col w-full space-y-4 pb-28"
    >
      {/* Welcome / Offline Hero Card */}
      <div className="relative bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white dark:bg-[#212019] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            OFFLINE VAULT
          </span>
          <span className="inline-flex items-center gap-1.5 font-sans text-xs text-[#58413f] dark:text-[#c8bead] font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#249B65] border border-[#171717] inline-block animate-pulse"></span>
            100% On-Device
          </span>
        </div>

        <h2 className="font-heading text-2xl text-[#1d1c11] dark:text-[#f6f1de] tracking-tight font-bold mb-2">
          Read anywhere, zero cloud.
        </h2>
        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mb-5 leading-relaxed">
          Instant, distraction-free access to your PDFs, technical specs, spreadsheets, and offline books.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            onClick={onImportFile}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>+ OPEN DOCUMENT</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            onClick={onViewAllFiles}
            className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-[#58413f] dark:text-[#c8bead]">folder_open</span>
            <span>BROWSE STORAGE</span>
          </motion.button>
        </div>
      </div>

      {/* Format Categories Section */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            FORMATS
          </span>
          <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
            {documents.length} total items
          </span>
        </div>

        <div className="flex items-stretch gap-3 overflow-x-auto py-1 px-1 no-scrollbar">
          {[
            { id: 'pdf', title: 'PDF', count: `${pdfCount} docs`, icon: 'picture_as_pdf', bg: 'bg-[#E65C56]' },
            { id: 'word', title: 'Word', count: `${wordCount} docs`, icon: 'description', bg: 'bg-[#3478D4]' },
            { id: 'excel', title: 'Sheets', count: `${excelCount} sheets`, icon: 'table_chart', bg: 'bg-[#249B65]' },
            { id: 'powerpoint', title: 'Slides', count: `${slidesCount} decks`, icon: 'slideshow', bg: 'bg-[#D88B32]' },
            { id: 'text', title: 'Text', count: `${textCount} files`, icon: 'code_blocks', bg: 'bg-[#8A65C9]' },
          ].map((cat) => (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -2 }}
              onClick={() => onSelectCategory(cat.id as any)}
              className="flex flex-col justify-between shrink-0 w-28 p-3 rounded-2xl bg-white dark:bg-[#212019] retro-border retro-shadow text-left cursor-pointer transition-shadow"
            >
              <div className={`w-8 h-8 rounded-lg ${cat.bg} retro-border-sm flex items-center justify-center text-white mb-2 retro-shadow-sm`}>
                <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
              </div>
              <div>
                <span className="block font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de]">{cat.title}</span>
                <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">{cat.count}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Reading Now / Quick Resume Card */}
      {activeDoc && (
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
              CURRENT SESSION
            </span>
            <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--primary-red)' }}>
                auto_stories
              </span>
              Read 18m today
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#f3eedc] dark:bg-[#333128] retro-border retro-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#E65C56] retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm">
                  <span className="material-symbols-outlined text-[22px]">menu_book</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                    {activeDoc.name}
                  </h3>
                  <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
                    Page {activeDoc.lastReadPage || 1} of {activeDoc.pageCount || 10} • {activeDoc.readProgress || 64}% read
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => onOpenDocument(activeDoc)}
                style={{ backgroundColor: 'var(--primary-red)' }}
                className="shrink-0 h-9 px-3.5 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>RESUME</span>
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              </motion.button>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full h-3 rounded-full bg-[#e7e2d1] dark:bg-[#474439] retro-border-sm p-0.5 overflow-hidden flex items-center">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${activeDoc.readProgress || 64}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ backgroundColor: 'var(--primary-red)' }}
                className="h-full rounded-full transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* Recent Documents List Section */}
      <div className="flex flex-col space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            RECENT DOCUMENTS
          </span>
          <button
            onClick={onViewAllFiles}
            style={{ color: 'var(--primary-red)' }}
            className="font-heading font-bold text-xs hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>VIEW ALL</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {/* Documents Panel */}
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow overflow-hidden divide-y-2 divide-[#171717] dark:divide-[#38352b]">
          {recentDocs.map((doc) => {
            const badge = getTypeBadgeConfig(doc.type, doc.extension);
            return (
              <motion.div
                key={doc.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => onOpenDocument(doc)}
                className="p-3 flex items-center justify-between gap-3 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{badge.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {doc.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-[#e7e2d1] dark:bg-[#474439] retro-border-sm font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] font-bold uppercase">
                        {badge.label}
                      </span>
                      <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate">
                        {formatFileSize(doc.size)} • {formatDateLabel(doc.modifiedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => onToggleFavorite(doc.id, e)}
                    aria-label="Favorite"
                    className={`w-8 h-8 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center ${
                      doc.isFavorite ? 'text-[#D88B32]' : 'text-[#58413f] dark:text-[#c8bead]'
                    } retro-shadow-sm cursor-pointer`}
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ fontVariationSettings: doc.isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      star
                    </span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => onOpenDocument(doc)}
                    aria-label="Open document options"
                    className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#58413f] dark:text-[#c8bead] retro-shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">more_vert</span>
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tactile Storage Micro-Widget */}
      <div className="p-4 rounded-2xl bg-[#ede8d6] dark:bg-[#3d3a30] retro-border retro-shadow flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-shadow-sm">
            <span className="material-symbols-outlined text-[20px]">sd_card</span>
          </div>
          <div>
            <p className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">Internal Storage</p>
            <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">2.14 GB used by Master Docs cache</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onViewAllFiles}
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#212019] retro-border-sm text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-[11px] uppercase tracking-wider retro-shadow-sm cursor-pointer"
        >
          MANAGE
        </motion.button>
      </div>
    </motion.div>
  );
};
