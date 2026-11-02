import React from 'react';
import { DocumentItem } from '../../types/document';
import { formatFileSize, formatDateLabel } from '../../utils/fileHelpers';

interface UnsupportedFileViewProps {
  document: DocumentItem;
  onBack: () => void;
  onShare?: () => void;
}

export const UnsupportedFileView: React.FC<UnsupportedFileViewProps> = ({
  document,
  onBack,
  onShare,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto min-h-[60vh]">
      <div className="w-16 h-16 rounded-2xl bg-[#f3eedc] dark:bg-[#333128] retro-border retro-shadow flex items-center justify-center text-[#58413f] dark:text-[#c8bead] mb-4">
        <span className="material-symbols-outlined text-[36px]">draft</span>
      </div>

      <span className="px-2.5 py-1 rounded-full bg-[#f3eedc] dark:bg-[#333128] retro-border-sm font-heading font-bold text-xs uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de] mb-3">
        FORMAT .{document.extension.toUpperCase()}
      </span>

      <h2 className="font-heading text-xl font-bold text-[#1d1c11] dark:text-[#f6f1de] mb-2 break-all">
        {document.name}
      </h2>

      <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mb-6">
        {formatFileSize(document.size)} • Modified {formatDateLabel(document.modifiedAt)}
      </p>

      <div className="w-full bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow mb-6 text-left">
        <div className="flex items-center gap-2 font-heading font-bold text-xs uppercase text-[#a92f2e] dark:text-[#ca4843] mb-1">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>Unsupported File Type</span>
        </div>
        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          MASTER DOCS currently provides direct offline rendering for <strong>PDF, DOCX, XLSX, CSV, PPTX, TXT, and MD</strong> files.
          This file format ({document.extension}) cannot be parsed inside the offline viewer.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        {onShare && (
          <button
            onClick={onShare}
            className="flex-1 h-12 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Share File</span>
          </button>
        )}
        <button
          onClick={onBack}
          className="flex-1 h-12 rounded-xl bg-[#a92f2e] text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Return to Files</span>
        </button>
      </div>
    </div>
  );
};
