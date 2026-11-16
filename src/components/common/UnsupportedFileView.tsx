import React, { useMemo } from 'react';
import { FileWarning, Info, Share2, ArrowLeft } from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { formatFileSize, formatDateLabel, getDocumentBytes } from '../../utils/fileHelpers';

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
  const hexSample = useMemo(() => {
    const bytes = getDocumentBytes(document);
    if (!bytes || bytes.length === 0) return null;
    const slice = bytes.subarray(0, 64);
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    return hex;
  }, [document]);

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto min-h-[60vh] pb-28">
      <div className="w-16 h-16 rounded-2xl bg-[#f3eedc] dark:bg-[#333128] retro-border retro-shadow flex items-center justify-center text-[#58413f] dark:text-[#c8bead] mb-4">
        <FileWarning className="w-8 h-8" />
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

      <div className="w-full bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow mb-6 text-left space-y-2">
        <div className="flex items-center gap-2 font-heading font-bold text-xs uppercase text-[var(--primary-red)]">
          <Info className="w-4 h-4 shrink-0" />
          <span>Binary File Preview Unavailable</span>
        </div>
        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          MASTER DOCS renders <strong>PDF, DOCX, ODT, RTF, EPUB, DOC, XLSX, XLS, ODS, CSV, PPTX, ODP, PPT, MD, JSON, XML, HTML, Code, Text, and Images</strong> offline.
          This binary file ({document.extension}) can be shared or opened with an external app.
        </p>
        {hexSample && (
          <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 font-mono text-[10px] break-all opacity-75">
            Header bytes: {hexSample}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        {onShare && (
          <button
            onClick={onShare}
            className="flex-1 h-12 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Open / Share</span>
          </button>
        )}
        <button
          onClick={onBack}
          style={{ backgroundColor: 'var(--primary-red)' }}
          className="flex-1 h-12 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Files</span>
        </button>
      </div>
    </div>
  );
};
