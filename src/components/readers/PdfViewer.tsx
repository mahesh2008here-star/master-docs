import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Lock, AlertCircle, RotateCw } from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { getDocumentBytes } from '../../utils/fileHelpers';
import {
  openPdfDocument,
  extractPdfPageText,
  destroyPdfDocument,
  PDFDocumentProxy,
  PdfPasswordRequiredError,
  RenderTask,
} from '../../services/pdfService';

interface PdfViewerProps {
  document: DocumentItem;
  currentPage: number;
  zoom: number;
  rotation: number;
  fitMode: 'width' | 'page';
  continuousScroll: boolean;
  searchQuery?: string;
  onLoadSuccess: (numPages: number) => void;
  onPageChange?: (page: number) => void;
  onSearchMatches?: (matchingPages: number[]) => void;
  onRotate?: () => void;
}

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  zoom: number;
  rotation: number;
  fitMode: 'width' | 'page';
  isVisible: boolean;
  pageSpacingClass: string;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  containerWidth,
  zoom,
  rotation,
  fitMode,
  isVisible,
  pageSpacingClass,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [rendering, setRendering] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: Math.max(280, containerWidth),
    height: Math.round(Math.max(280, containerWidth) * 1.414),
  });

  useEffect(() => {
    if (!isVisible || containerWidth <= 0) return;

    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }

      setRendering(true);
      setPageError(null);

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1, rotation });
        const availableWidth = Math.max(240, containerWidth - 8);
        const fitFactor = fitMode === 'page' ? 0.96 : 1.0;
        const cssScale = (availableWidth / baseViewport.width) * (zoom / 100) * fitFactor;
        const cssViewport = page.getViewport({ scale: Math.max(0.25, cssScale), rotation });

        const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
        const rawRenderW = cssViewport.width * dpr;
        const rawRenderH = cssViewport.height * dpr;
        const maxDim = 3600;
        const safeScaleFactor =
          Math.max(rawRenderW, rawRenderH) > maxDim
            ? maxDim / Math.max(rawRenderW, rawRenderH)
            : 1;

        const renderViewport = page.getViewport({
          scale: Math.max(0.25, cssScale * dpr * safeScaleFactor),
          rotation,
        });

        canvas.width = Math.max(1, Math.floor(renderViewport.width));
        canvas.height = Math.max(1, Math.floor(renderViewport.height));
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;

        setDimensions({
          width: Math.floor(cssViewport.width),
          height: Math.floor(cssViewport.height),
        });

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          throw new Error('Canvas 2D context unavailable');
        }

        // Fill white page background before painting PDF vectors/images
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          canvas,
        });
        renderTaskRef.current = task;
        await task.promise;

        if (!cancelled) {
          setRendering(false);
        }
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException' || cancelled) {
          return;
        }
        console.warn(`PDF page ${pageNumber} render warning:`, err);
        if (!cancelled) {
          setPageError(`Page ${pageNumber} failed to render.`);
          setRendering(false);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNumber, containerWidth, zoom, rotation, fitMode, isVisible]);

  return (
    <div className={`relative flex flex-col items-center w-full ${pageSpacingClass}`}>
      <div
        className="relative bg-white rounded-lg retro-border-sm shadow-sm overflow-hidden flex items-center justify-center max-w-none"
        style={{
          minHeight: rendering ? Math.min(480, dimensions.height) : undefined,
        }}
      >
        <canvas ref={canvasRef} className="block bg-white" />

        {rendering && !pageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--primary-red)]" />
          </div>
        )}

        {pageError && (
          <div className="p-4 text-center text-xs text-red-700 font-sans">
            {pageError}
          </div>
        )}
      </div>

      <span className="mt-1.5 font-heading font-bold text-[10px] uppercase tracking-wider opacity-60">
        Page {pageNumber}
      </span>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  document: doc,
  currentPage,
  zoom,
  rotation,
  fitMode,
  continuousScroll,
  searchQuery = '',
  onLoadSuccess,
  onPageChange,
  onSearchMatches,
  onRotate,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const textCacheRef = useRef<Map<number, string>>(new Map());

  const [containerWidth, setContainerWidth] = useState<number>(360);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [incorrectPassword, setIncorrectPassword] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');

  // Measure available reader width for crisp fit-to-width canvas scaling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loadPdfWithPassword = useCallback(
    async (pwd?: string) => {
      setLoading(true);
      setErrorMsg(null);
      setIncorrectPassword(false);

      // Destroy previous proxy if any
      if (pdfDocRef.current) {
        await destroyPdfDocument(pdfDocRef.current);
        pdfDocRef.current = null;
      }
      textCacheRef.current.clear();

      try {
        const bytes = getDocumentBytes(doc);
        if (!bytes || bytes.byteLength === 0) {
          throw new Error('No PDF binary data found in local vault.');
        }

        const loaded = await openPdfDocument(bytes, pwd);
        pdfDocRef.current = loaded;
        setPdfDoc(loaded);
        setNumPages(loaded.numPages);
        setNeedsPassword(false);
        setVisiblePages(new Set([Math.min(Math.max(1, currentPage), loaded.numPages), 1, 2]));
        setLoading(false);
        onLoadSuccess(loaded.numPages);
      } catch (err: any) {
        if (err instanceof PdfPasswordRequiredError) {
          setNeedsPassword(true);
          setIncorrectPassword(err.incorrectPassword);
          setLoading(false);
          return;
        }
        console.error('PDF loading failed:', err);
        setErrorMsg(err?.message || 'Unable to parse PDF file structure.');
        setLoading(false);
      }
    },
    [doc]
  );

  useEffect(() => {
    let active = true;
    if (active) {
      loadPdfWithPassword();
    }
    return () => {
      active = false;
      if (pdfDocRef.current) {
        destroyPdfDocument(pdfDocRef.current).catch(() => {});
        pdfDocRef.current = null;
      }
    };
  }, [loadPdfWithPassword]);

  // Observe pages in continuous scroll mode for lazy rendering & active page tracking
  useEffect(() => {
    if (!continuousScroll || !pdfDoc || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          let bestVisiblePage: number | null = null;
          let bestRatio = 0;

          for (const entry of entries) {
            const pageNum = Number((entry.target as HTMLElement).dataset.pageNumber);
            if (!pageNum) continue;
            if (entry.isIntersecting) {
              next.add(pageNum);
              if (pageNum > 1) next.add(pageNum - 1);
              if (pageNum < numPages) next.add(pageNum + 1);
              if (entry.intersectionRatio >= bestRatio) {
                bestRatio = entry.intersectionRatio;
                bestVisiblePage = pageNum;
              }
            }
          }

          if (bestVisiblePage && onPageChange && bestVisiblePage !== currentPage) {
            scrollUpdatedPageRef.current = bestVisiblePage;
            queueMicrotask(() => onPageChange(bestVisiblePage!));
          }
          return next;
        });
      },
      { threshold: [0.15, 0.5] }
    );

    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [continuousScroll, pdfDoc, numPages]);

  // Scroll to target page when currentPage changes programmatically in continuous scroll
  const prevManualPageRef = useRef<number>(currentPage);
  const scrollUpdatedPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (!continuousScroll) return;
    if (
      currentPage !== prevManualPageRef.current &&
      scrollUpdatedPageRef.current !== currentPage
    ) {
      const targetEl = pageRefs.current.get(currentPage);
      if (targetEl) {
        setVisiblePages((prev) => new Set(prev).add(currentPage));
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    scrollUpdatedPageRef.current = null;
    prevManualPageRef.current = currentPage;
  }, [currentPage, continuousScroll]);

  // Real In-Document PDF Text Search
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !pdfDoc || !onSearchMatches) {
      onSearchMatches?.([]);
      return;
    }

    let cancelled = false;
    async function runSearch() {
      if (!pdfDoc) return;
      const matches: number[] = [];
      const limit = Math.min(pdfDoc.numPages, 200);
      for (let p = 1; p <= limit; p++) {
        if (cancelled) return;
        let text = textCacheRef.current.get(p);
        if (text === undefined) {
          try {
            text = (await extractPdfPageText(pdfDoc, p)).toLowerCase();
            textCacheRef.current.set(p, text);
          } catch {
            text = '';
          }
        }
        if (text.includes(q)) {
          matches.push(p);
        }
      }
      if (!cancelled) {
        onSearchMatches?.(matches);
      }
    }

    const timer = setTimeout(runSearch, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, pdfDoc]);

  // Ensure active page + neighbors stay rendered in continuous scroll
  useEffect(() => {
    if (continuousScroll && pdfDoc && numPages > 0) {
      setVisiblePages((prev) => {
        const next = new Set(prev);
        next.add(currentPage);
        if (currentPage > 1) next.add(currentPage - 1);
        if (currentPage < numPages) next.add(currentPage + 1);
        return next;
      });
    }
  }, [currentPage, continuousScroll, pdfDoc, numPages]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center min-w-0">
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-red)]" />
          <p className="font-heading font-bold text-xs uppercase tracking-wider opacity-75">
            Opening PDF Document...
          </p>
        </div>
      )}

      {!loading && needsPassword && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadPdfWithPassword(passwordInput);
          }}
          className="w-full max-w-sm my-6 p-5 bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 text-[var(--primary-red)]">
            <Lock className="w-5 h-5" />
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
              Password Protected PDF
            </h4>
          </div>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
            {incorrectPassword
              ? 'Incorrect password. Please try again.'
              : 'Enter the document password to decrypt and render offline.'}
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Document password..."
            autoFocus
            className="h-10 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm text-sm focus:outline-none"
          />
          <button
            type="submit"
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="h-10 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm cursor-pointer"
          >
            Unlock PDF
          </button>
        </form>
      )}

      {!loading && errorMsg && (
        <div className="w-full my-6 p-5 bg-red-50 dark:bg-red-950/40 rounded-2xl retro-border-sm text-center flex flex-col items-center gap-2">
          <AlertCircle className="w-7 h-7 text-[var(--primary-red)]" />
          <p className="font-heading font-bold text-xs uppercase tracking-wider text-red-900 dark:text-red-200">
            Could Not Render PDF
          </p>
          <p className="font-sans text-xs text-red-800 dark:text-red-300 break-words max-w-md">
            {errorMsg}
          </p>
        </div>
      )}

      {!loading && !needsPassword && !errorMsg && pdfDoc && (
        <div className="w-full overflow-x-auto pb-2">
          {onRotate && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-sans text-[11px] opacity-70">
                {continuousScroll ? `Scroll view • ${numPages} pages` : `Page ${currentPage} of ${numPages}`}
              </span>
              <button
                type="button"
                onClick={onRotate}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-heading font-bold uppercase cursor-pointer hover:bg-black/10"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate {rotation}°</span>
              </button>
            </div>
          )}

          {continuousScroll ? (
            <div className="flex flex-col items-center w-full gap-4">
              {Array.from({ length: numPages }, (_, idx) => {
                const pageNum = idx + 1;
                return (
                  <div
                    key={pageNum}
                    data-page-number={pageNum}
                    ref={(el) => {
                      if (el) pageRefs.current.set(pageNum, el);
                      else pageRefs.current.delete(pageNum);
                    }}
                    className="w-full flex flex-col items-center"
                  >
                    <PdfPageCanvas
                      pdfDoc={pdfDoc}
                      pageNumber={pageNum}
                      containerWidth={containerWidth}
                      zoom={zoom}
                      rotation={rotation}
                      fitMode={fitMode}
                      isVisible={visiblePages.has(pageNum)}
                      pageSpacingClass=""
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <PdfPageCanvas
              pdfDoc={pdfDoc}
              pageNumber={Math.min(Math.max(1, currentPage), numPages)}
              containerWidth={containerWidth}
              zoom={zoom}
              rotation={rotation}
              fitMode={fitMode}
              isVisible={true}
              pageSpacingClass=""
            />
          )}
        </div>
      )}
    </div>
  );
};
