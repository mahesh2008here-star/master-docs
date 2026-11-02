import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, X, FileSearch, ArrowRight, SearchX } from 'lucide-react';
import { DocumentItem } from '../types/document';
import { getTypeBadgeConfig, formatFileSize, formatDateLabel } from '../utils/fileHelpers';
import { DocumentIcon } from '../components/common/DocumentIcon';

interface SearchScreenProps {
  documents: DocumentItem[];
  onOpenDocument: (doc: DocumentItem) => void;
  onBack: () => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  documents,
  onOpenDocument,
}) => {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return documents.filter((doc) => {
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.extension.toLowerCase().includes(q) ||
        (doc.content && doc.content.toLowerCase().includes(q))
      );
    });
  }, [documents, query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-4 pb-28 min-w-0"
    >
      {/* Search Input Box */}
      <div className="relative w-full">
        <div className="flex items-center gap-2 h-12 px-3 bg-white dark:bg-[#212019] rounded-xl retro-border retro-shadow">
          <Search className="w-5 h-5 text-[var(--primary-red)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type filename, extension, or document text..."
            autoFocus
            className="w-full bg-transparent border-none text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none placeholder:text-[#58413f]/60 min-w-0"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#58413f] hover:text-[#1d1c11] cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 min-w-0">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          SEARCH RESULTS ({searchResults.length})
        </span>
      </div>

      {!query.trim() ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow">
          <FileSearch className="w-12 h-12 text-[#58413f] dark:text-[#c8bead] mb-2" />
          <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] mb-1">
            Global Vault Search
          </h3>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
            Search across all imported offline PDFs, Word docs, spreadsheets, slides, and plain text notes.
          </p>
        </div>
      ) : searchResults.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow">
          <SearchX className="w-12 h-12 text-[#58413f] dark:text-[#c8bead] mb-2" />
          <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] mb-1">
            No Matching Documents
          </h3>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
            No document matches "{query}". Check spelling or try a broader keyword.
          </p>
        </div>
      ) : (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow overflow-hidden divide-y-2 divide-[#171717] dark:divide-[#38352b] min-w-0">
          {searchResults.map((doc) => {
            const badge = getTypeBadgeConfig(doc.type, doc.extension);
            return (
              <motion.div
                key={doc.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => onOpenDocument(doc)}
                className="p-3.5 flex items-center justify-between gap-2.5 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                  >
                    <DocumentIcon typeKey={badge.typeKey} className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block font-heading font-bold text-xs sm:text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {doc.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className="px-1.5 py-0.2 rounded bg-[#e7e2d1] dark:bg-[#474439] retro-border-sm font-sans text-[9px] sm:text-[10px] text-[#58413f] dark:text-[#c8bead] font-bold uppercase shrink-0">
                        {badge.label}
                      </span>
                      <span className="font-sans text-[10px] sm:text-[11px] text-[#58413f] dark:text-[#c8bead] truncate">
                        {formatFileSize(doc.size)} • {formatDateLabel(doc.modifiedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
