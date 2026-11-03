import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { renderPdfPages, RenderedPdfPage } from '../../services/pdfService';

interface PdfViewerProps {
  document: DocumentItem;
  currentPage: number;
  zoom: number;
  fitMode: 'width' | 'page';
  onLoadSuccess: (numPages: number) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  document: doc,
  currentPage,
  zoom,
  fitMode,
  onLoadSuccess,
}) => {
  const [pages, setPages] = useState<RenderedPdfPage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadPdf() {
      setLoading(true);
      setError(false);

      try {
        let source: string | ArrayBuffer | undefined = doc.arrayBuffer || doc.dataUri || doc.content;
        if (!source) {
          setError(true);
          setLoading(false);
          return;
        }

        // If source is base64 dataURI with application/pdf
        if (typeof source === 'string' && source.startsWith('data:application/pdf')) {
          const base64Str = source.split(',')[1] || source;
          const binaryStr = atob(base64Str);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          source = bytes.buffer;
        }

        const result = await renderPdfPages(source);
        if (isMounted) {
          setPages(result.pages);
          onLoadSuccess(result.totalPages);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to render PDF pages via canvas pipeline:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [doc]);

  const scale = (zoom / 100) * (fitMode === 'width' ? 1.15 : 0.95);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-red)]" />
        <p className="font-heading font-bold text-xs uppercase tracking-wider opacity-70">
          Rendering PDF Pages & Images...
        </p>
      </div>
    );
  }

  if (error || pages.length === 0) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 rounded-xl text-red-900 dark:text-red-200 text-xs font-sans text-center my-8 retro-border-sm">
        Failed to render PDF document. Please verify file integrity or re-import.
      </div>
    );
  }

  const currentPageData = pages[currentPage - 1] || pages[0];

  return (
    <div 
      className="flex flex-col items-center w-full min-w-0 transition-all duration-200"
      style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-4 w-full max-w-full"
        >
          {currentPageData?.canvasDataUrl ? (
            <img
              src={currentPageData.canvasDataUrl}
              alt={`Page ${currentPage}`}
              className="w-full h-auto rounded-lg retro-border-sm shadow-sm bg-white"
            />
          ) : (
            <div className="p-8 bg-black/5 rounded-lg text-xs font-sans text-center">
              [Page {currentPage} Rendering Canvas]
            </div>
          )}

          {currentPageData?.textContent && (
            <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words w-full px-2 opacity-90">
              {currentPageData.textContent}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
