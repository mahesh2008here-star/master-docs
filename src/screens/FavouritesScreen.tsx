import React from 'react';
import { motion } from 'motion/react';
import { DocumentItem } from '../types/document';
import { getTypeBadgeConfig, formatFileSize, formatDateLabel } from '../utils/fileHelpers';

interface FavouritesScreenProps {
  documents: DocumentItem[];
  onOpenDocument: (doc: DocumentItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onImportFile: () => void;
}

export const FavouritesScreen: React.FC<FavouritesScreenProps> = ({
  documents,
  onOpenDocument,
  onToggleFavorite,
  onImportFile,
}) => {
  const favoriteDocs = documents.filter((d) => d.isFavorite);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-4 pb-28"
    >
      <div className="flex items-center justify-between px-1">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          SAVED VAULT ITEMS
        </span>
        <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
          {favoriteDocs.length} starred documents
        </span>
      </div>

      {favoriteDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow">
          <span className="material-symbols-outlined text-[48px] text-[#D88B32] mb-2">bookmark_heart</span>
          <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] mb-1">
            No Favourites Saved Yet
          </h3>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mb-4">
            Tap the star icon on any document in your library to add it to your quick-access favourites vault.
          </p>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onImportFile}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="h-10 px-4 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer transition-colors"
          >
            + ADD DOCUMENTS
          </motion.button>
        </div>
      ) : (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow overflow-hidden divide-y-2 divide-[#171717] dark:divide-[#38352b]">
          {favoriteDocs.map((doc) => {
            const badge = getTypeBadgeConfig(doc.type, doc.extension);
            return (
              <motion.div
                key={doc.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => onOpenDocument(doc)}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{badge.icon}</span>
                  </div>

                  <div className="min-w-0">
                    <span className="block font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {doc.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.2 rounded bg-[#e7e2d1] dark:bg-[#474439] retro-border-sm font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] font-bold uppercase">
                        {badge.label}
                      </span>
                      <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate">
                        {formatFileSize(doc.size)} • {formatDateLabel(doc.modifiedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => onToggleFavorite(doc.id, e)}
                  aria-label="Remove favorite"
                  className="w-9 h-9 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#D88B32] retro-shadow-sm cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
