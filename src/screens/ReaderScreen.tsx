import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark,
  Search,
  Info,
  X,
  CheckCircle,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  Sun,
  Moon,
  BookOpen,
  Sparkles,
  Loader2,
  Share2,
  ScrollText,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { AppSettings, DocumentItem, ReaderTheme } from '../types/document';
import { parseWordDocument, parseDocxRawText } from '../services/docxService';
import { parseSpreadsheetBuffer, SheetData } from '../services/spreadsheetService';
import {
  parsePresentationText,
  parsePptxArrayBuffer,
  SlideItem,
} from '../services/presentationService';
import {
  formatMarkdownToHtml,
  formatCodeOrStructuredTextToHtml,
} from '../services/textService';
import {
  decodeTextBytes,
  formatDateLabel,
  formatFileSize,
  getDocumentBytes,
} from '../utils/fileHelpers';
import { shareDocumentFile } from '../services/shareService';
import { UnsupportedFileView } from '../components/common/UnsupportedFileView';
import { AnimatedIcon } from '../components/common/AnimatedIcon';
import { PdfViewer } from '../components/readers/PdfViewer';

interface ReaderScreenProps {
  document: DocumentItem;
  settings: AppSettings;
  onBack: () => void;
  onUpdatePage: (page: number, totalPages: number) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

function highlightHtmlMatches(html: string, query: string): { html: string; count: number } {
  const q = query.trim();
  if (!q || !html) return { html, count: 0 };

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  let count = 0;

  // Replace only in text segments outside HTML tags
  const parts = html.split(/(<[^>]+>)/g);
  const highlighted = parts
    .map((part) => {
      if (part.startsWith('<')) return part;
      return part.replace(regex, (match) => {
        count++;
        return `<mark class="bg-yellow-300 text-[#1d1c11] px-0.5 rounded">${match}</mark>`;
      });
    })
    .join('');

  return { html: highlighted, count };
}

function highlightPlainText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    regex.test(part) ? (
      <mark key={idx} className="bg-yellow-300 text-[#1d1c11] px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

const SHEET_ROWS_PER_PAGE = 150;

export const ReaderScreen: React.FC<ReaderScreenProps> = ({
  document: doc,
  settings,
  onBack,
  onUpdatePage,
  onToggleFavorite,
  onNotify,
}) => {
  const [theme, setTheme] = useState<ReaderTheme>(
    settings.themeMode === 'dark' ? 'ink' : 'parchment'
  );
  const [zoom, setZoom] = useState<number>(settings.defaultZoom || 100);
  const [rotation, setRotation] = useState<number>(0);
  const [continuousScroll, setContinuousScroll] = useState<boolean>(settings.continuousScroll);
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, doc.lastReadPage || 1));
  const [totalPages, setTotalPages] = useState<number>(Math.max(1, doc.pageCount || 1));
  const [fitMode, setFitMode] = useState<'width' | 'page'>('width');
  const [isBookmarked, setIsBookmarked] = useState<boolean>(doc.isFavorite);
  const [showDocInfo, setShowDocInfo] = useState<boolean>(false);

  // In-document search
  const [showInDocSearch, setShowInDocSearch] = useState<boolean>(false);
  const [searchInDocQuery, setSearchInDocQuery] = useState<string>('');
  const [pdfMatchingPages, setPdfMatchingPages] = useState<number[]>([]);

  // Jump-to-page modal (replaces window.prompt)
  const [showJumpModal, setShowJumpModal] = useState<boolean>(false);
  const [jumpInput, setJumpInput] = useState<string>('1');

  // Content parsing states
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<SheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [sheetRowPage, setSheetRowPage] = useState<number>(0);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(doc.type !== 'pdf');

  // Sync bookmark & reset when opening a new document
  useEffect(() => {
    setIsBookmarked(doc.isFavorite);
    setCurrentPage(Math.max(1, doc.lastReadPage || 1));
    setTotalPages(Math.max(1, doc.pageCount || 1));
    setZoom(settings.defaultZoom || 100);
    setRotation(0);
    setSearchInDocQuery('');
    setPdfMatchingPages([]);
    setActiveSheetIndex(0);
    setSheetRowPage(0);
    setParseError(null);
  }, [doc.id]);

  // Keep Screen Awake via Screen Wake Lock API when enabled
  useEffect(() => {
    if (!settings.keepScreenAwake || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }
    let sentinel: any = null;
    let active = true;

    (navigator as any).wakeLock
      .request('screen')
      .then((s: any) => {
        if (active) sentinel = s;
        else s.release?.();
      })
      .catch(() => {
        // Wake lock unsupported or denied in iframe; fail silently
      });

    return () => {
      active = false;
      sentinel?.release?.().catch(() => {});
    };
  }, [settings.keepScreenAwake, doc.id]);

  // Parse non-PDF documents
  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl: string | null = null;

    async function parseNonPdfDocument() {
      if (doc.type === 'pdf' || doc.type === 'other') {
        setLoading(false);
        return;
      }

      setLoading(true);
      setParseError(null);
      setRenderedHtml('');
      setSpreadsheetSheets([]);
      setSlides([]);
      setImageObjectUrl(null);

      try {
        const bytes = getDocumentBytes(doc);

        if (doc.type === 'image') {
          if (bytes) {
            const mime =
              doc.mimeType ||
              (doc.extension === 'svg'
                ? 'image/svg+xml'
                : doc.extension === 'png'
                ? 'image/png'
                : doc.extension === 'gif'
                ? 'image/gif'
                : doc.extension === 'webp'
                ? 'image/webp'
                : 'image/jpeg');
            const imgBuffer = bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength
            ) as ArrayBuffer;
            const blob = new Blob([imgBuffer], { type: mime });
            createdBlobUrl = URL.createObjectURL(blob);
            if (isMounted) {
              setImageObjectUrl(createdBlobUrl);
              setTotalPages(1);
            }
          } else {
            throw new Error('Image data could not be loaded.');
          }
        } else if (doc.type === 'word') {
          if (bytes && (doc.arrayBuffer || doc.dataUri)) {
            const res = await parseWordDocument(bytes, doc.extension);
            if (isMounted) {
              setRenderedHtml(res.html);
              setTotalPages(1);
            }
          } else if (doc.content) {
            const html = doc.content.trim().startsWith('<')
              ? doc.content
              : parseDocxRawText(doc.content);
            if (isMounted) {
              setRenderedHtml(html);
              setTotalPages(1);
            }
          } else {
            throw new Error('No document bytes available to render.');
          }
        } else if (doc.type === 'excel') {
          const source = bytes || doc.content;
          if (!source) throw new Error('Spreadsheet data is empty.');
          const parsed = parseSpreadsheetBuffer(source);
          if (isMounted) {
            setSpreadsheetSheets(parsed.sheets);
            const count = Math.max(1, parsed.sheets.length);
            setTotalPages(count);
            setActiveSheetIndex(Math.min(Math.max(0, (doc.lastReadPage || 1) - 1), count - 1));
          }
        } else if (doc.type === 'powerpoint') {
          if (bytes && (doc.arrayBuffer || doc.dataUri)) {
            const parsedSlides = await parsePptxArrayBuffer(bytes);
            if (isMounted) {
              setSlides(parsedSlides);
              setTotalPages(Math.max(1, parsedSlides.length));
            }
          } else if (doc.content) {
            const parsedSlides = parsePresentationText(doc.content);
            if (isMounted) {
              setSlides(parsedSlides);
              setTotalPages(Math.max(1, parsedSlides.length));
            }
          } else {
            throw new Error('No presentation data found.');
          }
        } else if (doc.type === 'markdown' || doc.type === 'text') {
          const textContent = doc.content ?? (bytes ? decodeTextBytes(bytes) : '');
          const html =
            doc.type === 'markdown'
              ? formatMarkdownToHtml(textContent)
              : formatCodeOrStructuredTextToHtml(textContent, doc.extension);
          if (isMounted) {
            setRenderedHtml(html);
            setTotalPages(1);
          }
        }
      } catch (err: any) {
        console.error('Document parsing failed:', err);
        if (isMounted) {
          setParseError(err?.message || 'Unable to parse this file.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    parseNonPdfDocument();

    return () => {
      isMounted = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [doc]);

  const handleShare = async () => {
    try {
      await shareDocumentFile(doc);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to share this document.');
    }
  };

  if (doc.type === 'other') {
    return <UnsupportedFileView document={doc} onBack={onBack} onShare={handleShare} />;
  }

  const handlePdfLoadSuccess = (numPages: number) => {
    setTotalPages(numPages);
    setLoading(false);
    const clampedPage = Math.min(Math.max(1, currentPage), numPages);
    if (clampedPage !== currentPage) setCurrentPage(clampedPage);
    onUpdatePage(clampedPage, numPages);
  };

  const goToPage = (targetPage: number) => {
    const clamped = Math.min(Math.max(1, targetPage), totalPages);
    setCurrentPage(clamped);
    if (doc.type === 'excel') {
      setActiveSheetIndex(clamped - 1);
      setSheetRowPage(0);
    }
    onUpdatePage(clamped, totalPages);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(200, z + 15));
  const handleZoomOut = () => setZoom((z) => Math.max(60, z - 15));

  const toggleBookmark = (e: React.MouseEvent) => {
    setIsBookmarked((prev) => !prev);
    onToggleFavorite(doc.id, e);
  };

  const getThemeStyles = () => {
    switch (theme) {
      case 'white':
        return 'bg-white text-[#1d1c11]';
      case 'sepia':
        return 'bg-[#f4ecd8] text-[#5c4b37]';
      case 'ink':
        return 'bg-[#212019] text-[#f6f1de]';
      case 'parchment':
      default:
        return 'bg-[#fffdf7] text-[#1d1c11]';
    }
  };

  const spacingClass =
    settings.pageSpacing === 'compact'
      ? 'p-3 sm:p-4 gap-3'
      : settings.pageSpacing === 'relaxed'
      ? 'p-5 sm:p-7 gap-6'
      : 'p-4 sm:p-5 gap-4';

  // Highlighted HTML & match count for Word/Markdown/Text
  const highlightedContent = useMemo(() => {
    return highlightHtmlMatches(renderedHtml, searchInDocQuery);
  }, [renderedHtml, searchInDocQuery]);

  // Matching slides for PowerPoint search
  const slideMatches = useMemo(() => {
    const q = searchInDocQuery.trim().toLowerCase();
    if (!q || doc.type !== 'powerpoint') return [];
    return slides
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.bulletPoints.some((bp) => bp.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      )
      .map((s) => s.slideNumber);
  }, [slides, searchInDocQuery, doc.type]);

  // Active spreadsheet sheet & filtered/paginated rows
  const activeSheet = spreadsheetSheets[activeSheetIndex];
  const filteredSheetRows = useMemo(() => {
    if (!activeSheet) return [];
    const q = searchInDocQuery.trim().toLowerCase();
    if (!q) return activeSheet.rows;
    return activeSheet.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q))
    );
  }, [activeSheet, searchInDocQuery]);

  const totalRowPages = Math.max(1, Math.ceil(filteredSheetRows.length / SHEET_ROWS_PER_PAGE));
  const safeRowPage = Math.min(sheetRowPage, totalRowPages - 1);
  const visibleSheetRows = filteredSheetRows.slice(
    safeRowPage * SHEET_ROWS_PER_PAGE,
    (safeRowPage + 1) * SHEET_ROWS_PER_PAGE
  );

  const textScalePx = Math.round(14 * (zoom / 100));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full relative pb-36 min-w-0"
    >
      {/* Top Document Ribbon */}
      <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f3eedc] dark:bg-[#333128] rounded-full retro-border-sm retro-shadow-sm min-w-0">
          <span
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-2 h-2 rounded-full shrink-0"
          />
          <span className="font-heading font-bold text-[10px] sm:text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            {doc.type === 'pdf'
              ? continuousScroll
                ? 'Scroll View'
                : 'Single Page'
              : doc.type === 'powerpoint'
              ? `Slide ${currentPage}/${totalPages}`
              : doc.type === 'excel'
              ? `Sheet ${activeSheetIndex + 1}/${Math.max(1, spreadsheetSheets.length)}`
              : `${doc.extension.toUpperCase()} Reader`}
          </span>
          <span className="text-[#58413f] dark:text-[#c8bead] shrink-0">•</span>
          <span className="font-heading font-bold text-[10px] sm:text-[11px] text-[#58413f] dark:text-[#c8bead] shrink-0">
            {zoom}%
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {doc.type === 'pdf' && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setContinuousScroll((v) => !v)}
              title={continuousScroll ? 'Switch to Single Page' : 'Switch to Continuous Scroll'}
              className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer"
            >
              {continuousScroll ? (
                <FileText className="w-4 h-4" />
              ) : (
                <ScrollText className="w-4 h-4" />
              )}
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleBookmark}
            title="Toggle Bookmark"
            style={{ color: isBookmarked ? 'var(--primary-red)' : undefined }}
            className={`w-8 h-8 rounded-lg bg-white dark:bg-[#212019] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer ${
              isBookmarked ? '' : 'text-[#58413f] dark:text-[#c8bead]'
            }`}
          >
            <AnimatedIcon
              icon={Bookmark}
              className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`}
            />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowInDocSearch((v) => !v)}
            title="Search Inside Document"
            style={{ color: showInDocSearch ? 'var(--primary-red)' : undefined }}
            className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer"
          >
            <AnimatedIcon icon={Search} className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleShare}
            title="Share / Export File"
            className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer"
          >
            <AnimatedIcon icon={Share2} className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowDocInfo((v) => !v)}
            title="Document Details"
            className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer"
          >
            <AnimatedIcon icon={Info} className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* In-Document Search Bar */}
      <AnimatePresence>
        {showInDocSearch && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 p-2.5 bg-white dark:bg-[#212019] rounded-xl retro-border retro-shadow flex flex-col gap-2 min-w-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-4 h-4 text-[#58413f] dark:text-[#c8bead] shrink-0" />
              <input
                type="text"
                value={searchInDocQuery}
                onChange={(e) => {
                  setSearchInDocQuery(e.target.value);
                  setSheetRowPage(0);
                }}
                placeholder="Search text within this document..."
                autoFocus
                className="w-full bg-transparent text-xs font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none min-w-0"
              />
              {searchInDocQuery && (
                <button
                  onClick={() => setSearchInDocQuery('')}
                  className="text-[#58413f] dark:text-[#c8bead] shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {searchInDocQuery.trim() && (
              <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-black/10 dark:border-white/10 text-[11px] font-sans">
                {doc.type === 'pdf' && (
                  <>
                    <span className="opacity-75">
                      {pdfMatchingPages.length > 0
                        ? `Found on ${pdfMatchingPages.length} page(s):`
                        : 'No matching pages found.'}
                    </span>
                    {pdfMatchingPages.slice(0, 10).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        style={{
                          backgroundColor:
                            currentPage === pageNum ? 'var(--primary-red)' : undefined,
                        }}
                        className={`px-2 py-0.5 rounded font-heading font-bold text-[10px] retro-border-sm cursor-pointer ${
                          currentPage === pageNum
                            ? 'text-white'
                            : 'bg-[#f3eedc] dark:bg-[#333128] text-[#1d1c11] dark:text-[#f6f1de]'
                        }`}
                      >
                        P.{pageNum}
                      </button>
                    ))}
                  </>
                )}

                {doc.type === 'powerpoint' && (
                  <>
                    <span className="opacity-75">
                      {slideMatches.length > 0
                        ? `Found on ${slideMatches.length} slide(s):`
                        : 'No matching slides found.'}
                    </span>
                    {slideMatches.slice(0, 10).map((slideNum) => (
                      <button
                        key={slideNum}
                        onClick={() => goToPage(slideNum)}
                        style={{
                          backgroundColor:
                            currentPage === slideNum ? 'var(--primary-red)' : undefined,
                        }}
                        className={`px-2 py-0.5 rounded font-heading font-bold text-[10px] retro-border-sm cursor-pointer ${
                          currentPage === slideNum
                            ? 'text-white'
                            : 'bg-[#f3eedc] dark:bg-[#333128] text-[#1d1c11] dark:text-[#f6f1de]'
                        }`}
                      >
                        Slide {slideNum}
                      </button>
                    ))}
                  </>
                )}

                {doc.type === 'excel' && (
                  <span className="opacity-75">
                    {filteredSheetRows.length} matching row(s) in "{activeSheet?.name}"
                  </span>
                )}

                {(doc.type === 'word' || doc.type === 'text' || doc.type === 'markdown') && (
                  <span className="opacity-75">
                    {highlightedContent.count} match(es) highlighted below
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Information Drawer */}
      <AnimatePresence>
        {showDocInfo && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 p-4 bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow flex flex-col gap-1.5 min-w-0"
          >
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2 mb-1">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
                Document Metadata
              </h4>
              <button
                onClick={() => setShowDocInfo(false)}
                className="text-[#58413f] dark:text-[#c8bead] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] break-all">
              File: {doc.name}
            </p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
              Format: .{doc.extension.toUpperCase()} • Size: {formatFileSize(doc.size)}
            </p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
              Sections / Pages: {totalPages} • Updated: {formatDateLabel(doc.modifiedAt)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHYSICAL DOCUMENT SHEET CONTAINER (No double CSS transform!) */}
      <article
        className={`relative w-full rounded-2xl retro-border retro-shadow-lg transition-colors duration-200 overflow-hidden min-w-0 ${getThemeStyles()}`}
      >
        {/* Sheet Top Header */}
        <div className="px-4 py-3 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="px-2 py-0.5 text-white rounded font-heading font-bold text-[10px] uppercase shrink-0"
            >
              {doc.extension.toUpperCase()}
            </span>
            <span className="font-heading font-bold text-xs uppercase tracking-wide truncate">
              {doc.name}
            </span>
          </div>
          <span className="font-heading font-bold text-[11px] opacity-70 shrink-0">
            {formatFileSize(doc.size)}
          </span>
        </div>

        {/* INNER CONTENT PAGE AREA */}
        <div className={`flex flex-col min-h-[420px] min-w-0 ${spacingClass}`}>
          {doc.type === 'pdf' ? (
            <PdfViewer
              document={doc}
              currentPage={currentPage}
              zoom={zoom}
              rotation={rotation}
              fitMode={fitMode}
              continuousScroll={continuousScroll}
              searchQuery={searchInDocQuery}
              onLoadSuccess={handlePdfLoadSuccess}
              onPageChange={(p) => {
                setCurrentPage(p);
                onUpdatePage(p, totalPages);
              }}
              onSearchMatches={setPdfMatchingPages}
              onRotate={() => setRotation((r) => (r + 90) % 360)}
            />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-red)]" />
              <p className="font-heading font-bold text-xs uppercase tracking-wider opacity-75">
                Loading Document...
              </p>
            </div>
          ) : parseError ? (
            <div className="my-6 p-5 bg-red-50 dark:bg-red-950/40 rounded-2xl retro-border-sm text-center flex flex-col items-center gap-2">
              <AlertCircle className="w-7 h-7 text-[var(--primary-red)]" />
              <p className="font-heading font-bold text-xs uppercase text-red-900 dark:text-red-200">
                Could Not Open Document
              </p>
              <p className="font-sans text-xs text-red-800 dark:text-red-300">
                {parseError}
              </p>
              <button
                onClick={handleShare}
                className="mt-2 px-4 py-2 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm text-xs font-heading font-bold uppercase cursor-pointer"
              >
                Open / Share Externally
              </button>
            </div>
          ) : doc.type === 'image' && imageObjectUrl ? (
            <div className="w-full overflow-x-auto flex flex-col items-center justify-center py-2">
              <img
                src={imageObjectUrl}
                alt={doc.name}
                style={{ width: `${zoom}%`, maxWidth: zoom <= 100 ? '100%' : 'none' }}
                className="h-auto rounded-xl retro-border-sm bg-white object-contain"
              />
            </div>
          ) : doc.type === 'excel' ? (
            <div className="flex flex-col gap-3 min-w-0">
              {spreadsheetSheets.length > 0 && activeSheet ? (
                <>
                  {/* Sheet selector tabs */}
                  <div className="flex items-center gap-1.5 border-b border-black/10 dark:border-white/10 pb-2 overflow-x-auto no-scrollbar">
                    {spreadsheetSheets.map((sheet, index) => (
                      <button
                        key={`${sheet.name}-${index}`}
                        onClick={() => {
                          setActiveSheetIndex(index);
                          setSheetRowPage(0);
                          setCurrentPage(index + 1);
                          onUpdatePage(index + 1, spreadsheetSheets.length);
                        }}
                        style={{
                          backgroundColor:
                            activeSheetIndex === index ? 'var(--primary-red)' : undefined,
                        }}
                        className={`px-3 py-1 rounded-lg font-heading font-bold text-xs uppercase cursor-pointer whitespace-nowrap shrink-0 retro-border-sm ${
                          activeSheetIndex === index
                            ? 'text-white'
                            : 'bg-black/5 dark:bg-white/10 text-inherit'
                        }`}
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>

                  {/* Table grid */}
                  <div className="overflow-x-auto max-h-[65vh] rounded-xl border border-black/20 dark:border-white/20">
                    <table
                      className="w-full border-collapse font-mono"
                      style={{ fontSize: `${Math.max(10, Math.round(12 * (zoom / 100)))}px` }}
                    >
                      <thead className="sticky top-0 z-10 bg-[#f3eedc] dark:bg-[#333128]">
                        <tr>
                          <th className="p-2 border border-black/15 dark:border-white/15 text-center font-bold opacity-60 w-10">
                            #
                          </th>
                          {activeSheet.headers.map((header, idx) => (
                            <th
                              key={idx}
                              className="p-2 border border-black/15 dark:border-white/15 text-left font-bold whitespace-nowrap"
                            >
                              {highlightPlainText(header, searchInDocQuery)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSheetRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeSheet.headers.length + 1}
                              className="p-6 text-center font-sans text-xs opacity-70"
                            >
                              No rows match your filter.
                            </td>
                          </tr>
                        ) : (
                          visibleSheetRows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="hover:bg-black/5 dark:hover:bg-white/5"
                            >
                              <td className="p-2 border border-black/10 dark:border-white/10 text-center opacity-50 whitespace-nowrap">
                                {safeRowPage * SHEET_ROWS_PER_PAGE + rIdx + 1}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="p-2 border border-black/10 dark:border-white/10 whitespace-nowrap"
                                >
                                  {highlightPlainText(cell, searchInDocQuery)}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Row pagination when sheet has > 150 rows */}
                  {totalRowPages > 1 && (
                    <div className="flex items-center justify-between text-xs font-sans pt-1">
                      <span className="opacity-75">
                        Rows {safeRowPage * SHEET_ROWS_PER_PAGE + 1}–
                        {Math.min(
                          (safeRowPage + 1) * SHEET_ROWS_PER_PAGE,
                          filteredSheetRows.length
                        )}{' '}
                        of {filteredSheetRows.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={safeRowPage <= 0}
                          onClick={() => setSheetRowPage((p) => Math.max(0, p - 1))}
                          className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-heading font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Prev Rows
                        </button>
                        <button
                          disabled={safeRowPage >= totalRowPages - 1}
                          onClick={() =>
                            setSheetRowPage((p) => Math.min(totalRowPages - 1, p + 1))
                          }
                          className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-heading font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Next Rows
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm font-sans opacity-75">Spreadsheet contains no sheets.</p>
              )}
            </div>
          ) : doc.type === 'powerpoint' ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4 min-w-0"
              >
                {slides.length > 0 ? (
                  (() => {
                    const slide = slides[Math.min(currentPage - 1, slides.length - 1)];
                    return (
                      <div
                        className="p-4 sm:p-6 bg-black/5 dark:bg-white/5 rounded-2xl retro-border-sm flex flex-col gap-3 min-w-0"
                        style={{ fontSize: `${textScalePx}px` }}
                      >
                        <span
                          style={{ color: 'var(--primary-red)' }}
                          className="font-heading font-bold text-xs uppercase tracking-widest"
                        >
                          SLIDE {slide.slideNumber} OF {slides.length}
                        </span>
                        <h2 className="font-heading text-xl sm:text-2xl font-bold break-words">
                          {highlightPlainText(slide.title, searchInDocQuery)}
                        </h2>

                        {slide.images.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-1">
                            {slide.images.map((imgSrc, imgIdx) => (
                              <div
                                key={imgIdx}
                                className="rounded-xl overflow-hidden retro-border-sm bg-white p-1.5 flex items-center justify-center"
                              >
                                <img
                                  src={imgSrc}
                                  alt={`Slide ${slide.slideNumber} graphic ${imgIdx + 1}`}
                                  className="w-full h-auto object-contain max-h-[280px] rounded"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {slide.bulletPoints.length > 0 && (
                          <ul className="flex flex-col gap-2">
                            {slide.bulletPoints.map((point, idx) => (
                              <li key={idx} className="font-sans flex items-start gap-2 break-words">
                                <span
                                  style={{ color: 'var(--primary-red)' }}
                                  className="font-bold shrink-0"
                                >
                                  •
                                </span>
                                <span>{highlightPlainText(point, searchInDocQuery)}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {slide.notes && (
                          <div className="mt-2 pt-3 border-t border-black/10 dark:border-white/10">
                            <span className="font-heading font-bold text-[10px] uppercase tracking-wider opacity-70 block mb-1">
                              Speaker Notes
                            </span>
                            <p className="font-sans text-xs opacity-85 whitespace-pre-wrap break-words">
                              {highlightPlainText(slide.notes, searchInDocQuery)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm font-sans opacity-75">No slides found in deck.</p>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div
              style={{ fontSize: `${textScalePx}px` }}
              className="prose max-w-none font-sans leading-relaxed break-words min-w-0 select-text"
              dangerouslySetInnerHTML={{
                __html:
                  highlightedContent.html ||
                  '<p class="text-sm font-sans opacity-75">Document contains no text.</p>',
              }}
            />
          )}

          {/* Document Page Footer */}
          <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 opacity-75 min-w-0">
              <CheckCircle className="w-4 h-4 text-[#249B65] shrink-0" />
              <span className="font-heading font-bold text-[10px] uppercase tracking-wider truncate">
                On-Device Offline Reader
              </span>
            </div>
            <div className="px-2.5 py-1 rounded bg-black/5 dark:bg-white/10 font-heading text-xs font-bold shrink-0">
              {currentPage} / {totalPages}
            </div>
          </div>
        </div>
      </article>

      {/* Next Page Cue (only when multi-page / multi-slide / multi-sheet) */}
      {totalPages > 1 && currentPage < totalPages && (
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={handleNextPage}
          className="mt-4 mx-2 bg-[#ede8d6] dark:bg-[#3d3a30] rounded-xl p-3 retro-border-sm retro-shadow-sm flex items-center justify-between cursor-pointer hover:bg-[#e7e2d1] min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ArrowDown className="w-4 h-4 shrink-0" />
            <span className="font-sans text-xs font-medium truncate">
              {doc.type === 'powerpoint'
                ? `Slide ${currentPage + 1}: Next Slide`
                : doc.type === 'excel'
                ? `Sheet ${currentPage + 1}: ${spreadsheetSheets[currentPage]?.name || 'Next Sheet'}`
                : `Page ${currentPage + 1} of ${totalPages}`}
            </span>
          </div>
          <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm shrink-0">
            NEXT
          </span>
        </motion.div>
      )}

      {/* Jump to Page Modal */}
      <AnimatePresence>
        {showJumpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={(e) => {
                e.preventDefault();
                const num = parseInt(jumpInput, 10);
                if (!isNaN(num) && num >= 1 && num <= totalPages) {
                  goToPage(num);
                  setShowJumpModal(false);
                } else {
                  onNotify('error', `Enter a page number between 1 and ${totalPages}.`);
                }
              }}
              className="w-full max-w-xs bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow-lg flex flex-col gap-3"
            >
              <h3 className="font-heading font-bold text-sm uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
                Jump to {doc.type === 'powerpoint' ? 'Slide' : doc.type === 'excel' ? 'Sheet' : 'Page'} (1–{totalPages})
              </h3>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                autoFocus
                className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm text-sm font-heading font-bold focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowJumpModal(false)}
                  className="flex-1 h-10 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase retro-border-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: 'var(--primary-red)' }}
                  className="flex-1 h-10 rounded-xl text-white font-heading font-bold text-xs uppercase retro-border-sm cursor-pointer"
                >
                  Go
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING RETRO-TACTILE READER TOOLBAR DOCK */}
      <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
        <div className="w-full bg-[#f3eedc]/95 dark:bg-[#333128]/95 backdrop-blur-md rounded-2xl p-2.5 retro-border retro-shadow-lg flex flex-col gap-2">
          {/* Controls Row 1 */}
          <div className="flex items-center justify-between gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Previous Page"
              className="h-10 w-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-45 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (totalPages > 1) {
                  setJumpInput(String(currentPage));
                  setShowJumpModal(true);
                }
              }}
              aria-label="Jump to page"
              className="h-10 sm:h-11 flex-1 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center gap-1.5 retro-border-sm retro-shadow-sm cursor-pointer min-w-0"
            >
              <BookOpen className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
              <span className="font-heading font-bold text-sm tracking-tight">{currentPage}</span>
              <span className="font-heading text-xs text-[#58413f] dark:text-[#c8bead]">
                / {totalPages}
              </span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Next Page"
              className="h-10 w-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-45 shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const nextMode = fitMode === 'page' ? 'width' : 'page';
                setFitMode(nextMode);
                setZoom(100);
              }}
              aria-label="Toggle Fit Mode"
              className="h-10 sm:h-11 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center gap-1 retro-border-sm retro-shadow-sm cursor-pointer shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="font-heading font-bold text-xs uppercase hidden sm:inline">
                {fitMode}
              </span>
            </motion.button>
          </div>

          {/* Controls Row 2 */}
          <div className="flex items-center justify-between pt-1 gap-2">
            {/* Zoom Stepper */}
            <div className="flex items-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-xl p-0.5 retro-border-sm retro-shadow-sm shrink-0">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleZoomOut}
                aria-label="Zoom out"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </motion.button>
              <span className="px-2 font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">
                {zoom}%
              </span>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleZoomIn}
                aria-label="Zoom in"
                className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </motion.button>
            </div>

            {/* Paper Tone Toggles */}
            <div className="flex items-center gap-1 bg-[#f9f4e1] dark:bg-[#2b2921] rounded-xl p-1 retro-border-sm retro-shadow-sm shrink-0">
              {[
                { id: 'parchment', title: 'Warm Paper', icon: BookOpen },
                { id: 'white', title: 'Pure White', icon: Sun },
                { id: 'sepia', title: 'Sepia Tone', icon: Sparkles },
                { id: 'ink', title: 'Dark Ink', icon: Moon },
              ].map((t) => {
                const isActive = theme === t.id;
                const IconComp = t.icon;
                return (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setTheme(t.id as ReaderTheme)}
                    title={t.title}
                    style={{ color: isActive ? 'var(--primary-red)' : undefined }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isActive ? 'bg-white dark:bg-[#212019] retro-border-sm' : 'text-[#58413f]'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
