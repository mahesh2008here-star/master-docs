import React from 'react';
import { motion } from 'motion/react';
import { Clock, Play } from 'lucide-react';
import { ReadingSession, DocumentItem } from '../types/document';
import { getTypeBadgeConfig, getDocumentType, formatDateLabel } from '../utils/fileHelpers';
import { DocumentIcon } from '../components/common/DocumentIcon';

interface RecentScreenProps {
  sessions: ReadingSession[];
  documents: DocumentItem[];
  onOpenDocument: (doc: DocumentItem) => void;
  onClearHistory: () => void;
}

export const RecentScreen: React.FC<RecentScreenProps> = ({
  sessions,
  documents,
  onOpenDocument,
  onClearHistory,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-4 pb-28 min-w-0"
    >
      <div className="flex items-center justify-between px-1 min-w-0">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          READING HISTORY
        </span>
        {sessions.length > 0 && (
          <button
            onClick={onClearHistory}
            style={{ color: 'var(--primary-red)' }}
            className="font-heading font-bold text-xs hover:underline cursor-pointer shrink-0"
          >
            CLEAR HISTORY
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow">
          <Clock className="w-12 h-12 text-[#58413f] dark:text-[#c8bead] mb-2" />
          <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] mb-1">
            No Recent Reading Sessions
          </h3>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
            Open any document from your library to keep track of your reading progress and history.
          </p>
        </div>
      ) : (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow overflow-hidden divide-y-2 divide-[#171717] dark:divide-[#38352b] min-w-0">
          {sessions.map((session) => {
            const targetDoc = documents.find((d) => d.id === session.documentId);
            const docType = getDocumentType(session.extension);
            const badge = getTypeBadgeConfig(docType, session.extension);

            return (
              <motion.div
                key={session.documentId}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  if (targetDoc) onOpenDocument(targetDoc);
                }}
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
                      {session.documentName}
                    </span>
                    <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate">
                      Page {session.currentPage} of {session.totalPages} • {session.progressPercent}% read • {formatDateLabel(session.lastOpenedAt)}
                    </p>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    if (targetDoc) onOpenDocument(targetDoc);
                  }}
                  style={{ backgroundColor: 'var(--primary-red)' }}
                  className="h-9 px-3 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  <span>RESUME</span>
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
