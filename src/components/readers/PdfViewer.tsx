import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import { DocumentItem } from '../../types/document';

// Configure pdfjs worker for worker-based rendering pipeline
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let createdUrl: string | null = null;
    setError(false);
    setLoading(true);

    try {
      if (doc.arrayBuffer) {
        const blob = new Blob([doc.arrayBuffer], { type: 'application/pdf' });
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } else if (doc.dataUri) {
        if (doc.dataUri.startsWith('data:application/pdf')) {
          const base64Str = doc.dataUri.split(',')[1] || doc.dataUri;
          const binaryStr = atob(base64Str);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes.buffer], { type: 'application/pdf' });
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        } else {
          setBlobUrl(doc.dataUri);
        }
      } else if (doc.content) {
        if (doc.content.startsWith('data:application/pdf')) {
          setBlobUrl(doc.content);
        } else {
          const blob = new Blob([doc.content], { type: 'application/pdf' });
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } else {
        setError(true);
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to convert PDF binary data to Blob URL:', err);
      // Fallback to dataUri if blob conversion encounters issues
      setBlobUrl(doc.dataUri || doc.content || null);
    }

    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [doc]);

  const scale = (zoom / 100) * (fitMode === 'width' ? 1.15 : 0.95);

  if (error || (!blobUrl && !loading)) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-xl text-red-900 dark:text-red-200 text-xs font-sans text-center my-8 retro-border-sm">
        Failed to initialize PDF renderer. Please ensure the imported PDF file is valid.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-w-0">
      {blobUrl && (
        <Document
          file={blobUrl}
          onLoadSuccess={({ numPages }) => {
            setLoading(false);
            onLoadSuccess(numPages);
          }}
          onLoadError={(err) => {
            console.error('react-pdf document load error:', err);
            setError(true);
            setLoading(false);
          }}
          loading={
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-red)]" />
              <p className="font-heading font-bold text-xs uppercase tracking-wider opacity-70">
                Opening PDF Document...
              </p>
            </div>
          }
          error={
            <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-xl text-red-900 dark:text-red-200 text-xs font-sans text-center my-8 retro-border-sm">
              Failed to render PDF document. Please verify file integrity or re-import.
            </div>
          }
          className="flex flex-col items-center w-full min-w-0"
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="retro-border-sm rounded-lg overflow-hidden max-w-full my-2 shadow-xs"
          />
        </Document>
      )}
    </div>
  );
};
