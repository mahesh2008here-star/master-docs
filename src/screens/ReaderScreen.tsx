import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { DocumentItem, ReaderTheme } from '../types/document';
import { parseDocxRawText, convertDocxToHtml } from '../services/docxService';
import { parseSpreadsheetBuffer, SheetData } from '../services/spreadsheetService';
import { parsePresentationText, parsePptxArrayBuffer, SlideItem } from '../services/presentationService';
import { formatMarkdownToHtml } from '../services/textService';
import { UnsupportedFileView } from '../components/common/UnsupportedFileView';
import { AnimatedIcon } from '../components/common/AnimatedIcon';
import { PdfViewer } from '../components/readers/PdfViewer';

interface ReaderScreenProps {
  document: DocumentItem;
  onBack: () => void;
  onUpdatePage: (page: number, totalPages: number) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export const ReaderScreen: React.FC<ReaderScreenProps> = ({
  document: doc,
  onBack,
  onUpdatePage,
  onToggleFavorite,
}) => {
  const [theme, setTheme] = useState<ReaderTheme>('parchment');
  const [zoom, setZoom] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(doc.lastReadPage || 1);
  const [totalPages, setTotalPages] = useState<number>(doc.pageCount || 10);
  const [fitMode, setFitMode] = useState<'width' | 'page'>('page');
  const [isBookmarked, setIsBookmarked] = useState<boolean>(doc.isFavorite);
  const [showDocInfo, setShowDocInfo] = useState<boolean>(false);
  const [searchInDocQuery, setSearchInDocQuery] = useState<string>('');
  const [showInDocSearch, setShowInDocSearch] = useState<boolean>(false);

  // Content parsing states
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<SheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [formattedTextHtml, setFormattedTextHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function parseNonPdfDocumentContent() {
      if (doc.type === 'pdf') {
        return; // PDF handled by PdfViewer component
      }

      setLoading(true);

      try {
        if (doc.type === 'word') {
          if (doc.arrayBuffer) {
            const result = await convertDocxToHtml(doc.arrayBuffer);
            if (isMounted) setDocxHtml(result.html);
          } else if (doc.content) {
            if (doc.content.trim().startsWith('<')) {
              setDocxHtml(doc.content);
            } else {
              setDocxHtml(parseDocxRawText(doc.content));
            }
          }
          setTotalPages(doc.pageCount || 12);
        } else if (doc.type === 'excel') {
          if (doc.arrayBuffer) {
            const data = parseSpreadsheetBuffer(doc.arrayBuffer);
            if (isMounted) {
              setSpreadsheetSheets(data.sheets);
              setTotalPages(data.sheets.length || 1);
            }
          } else if (doc.content) {
            const data = parseSpreadsheetBuffer(doc.content);
            if (isMounted) {
              setSpreadsheetSheets(data.sheets);
              setTotalPages(data.sheets.length || 1);
            }
          }
        } else if (doc.type === 'powerpoint') {
          if (doc.arrayBuffer) {
            const parsedSlides = await parsePptxArrayBuffer(doc.arrayBuffer);
            if (isMounted) {
              setSlides(parsedSlides);
              setTotalPages(parsedSlides.length || 1);
            }
          } else if (doc.dataUri) {
            const base64Str = doc.dataUri.split(',')[1] || doc.dataUri;
            const binaryStr = atob(base64Str);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const parsedSlides = await parsePptxArrayBuffer(bytes.buffer);
            if (isMounted) {
              setSlides(parsedSlides);
              setTotalPages(parsedSlides.length || 1);
            }
          } else if (doc.content) {
            const parsedSlides = parsePresentationText(doc.content);
            if (isMounted) {
              setSlides(parsedSlides);
              setTotalPages(parsedSlides.length || 1);
            }
          }
        } else if (doc.type === 'text' || doc.type === 'markdown') {
          if (doc.content) {
            if (doc.content.trim().startsWith('<')) {
              setFormattedTextHtml(doc.content);
            } else {
              setFormattedTextHtml(formatMarkdownToHtml(doc.content));
            }
          }
          setTotalPages(doc.pageCount || 4);
        }
      } catch (err) {
        console.warn('Error parsing document:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    parseNonPdfDocumentContent();
    return () => {
      isMounted = false;
    };
  }, [doc]);

  const handlePdfLoadSuccess = (numPages: number) => {
    setTotalPages(numPages);
    setLoading(false);
    onUpdatePage(currentPage, numPages);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      onUpdatePage(nextPage, totalPages);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      onUpdatePage(prevPage, totalPages);
    }
  };

  const handleZoomIn = () => {
    if (zoom < 180) setZoom((z) => z + 15);
  };

  const handleZoomOut = () => {
    if (zoom > 70) setZoom((z) => z - 15);
  };

  const toggleBookmark = (e: React.MouseEvent) => {
    setIsBookmarked(!isBookmarked);
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

  if (doc.type === 'other') {
    return <UnsupportedFileView document={doc} onBack={onBack} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 15 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="flex flex-col w-full relative select-none pb-36 min-w-0"
    >
      {/* Top Document Ribbon */}
      <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f3eedc] dark:bg-[#333128] rounded-full retro-border-sm retro-shadow-sm min-w-0">
          <span
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-2 h-2 rounded-full animate-pulse shrink-0"
          />
          <span className="font-heading font-bold text-[10px] sm:text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Continuous Scroll
          </span>
          <span className="text-[#58413f] dark:text-[#c8bead] shrink-0">•</span>
          <span className="font-heading font-bold text-[10px] sm:text-[11px] text-[#58413f] dark:text-[#c8bead] shrink-0">
            {zoom}%
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleBookmark}
            title="Toggle Bookmark"
            style={{ color: isBookmarked ? 'var(--primary-red)' : undefined }}
            className={`w-8 h-8 rounded-lg bg-white dark:bg-[#212019] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer ${
              isBookmarked ? '' : 'text-[#58413f] dark:text-[#c8bead]'
            }`}
          >
            <AnimatedIcon icon={Bookmark} className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowInDocSearch(!showInDocSearch)}
            title="Search Text"
            className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer"
          >
            <AnimatedIcon icon={Search} className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowDocInfo(!showDocInfo)}
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
            className="mb-3 p-2 bg-white dark:bg-[#212019] rounded-xl retro-border retro-shadow flex items-center gap-2 min-w-0"
          >
            <Search className="w-4 h-4 text-[#58413f] shrink-0" />
            <input
              type="text"
              value={searchInDocQuery}
              onChange={(e) => setSearchInDocQuery(e.target.value)}
              placeholder="Search within this document..."
              className="w-full bg-transparent text-xs font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none min-w-0"
            />
            {searchInDocQuery && (
              <button onClick={() => setSearchInDocQuery('')} className="text-[#58413f] shrink-0">
                <X className="w-4 h-4" />
              </button>
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
            className="mb-4 p-4 bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow flex flex-col gap-2 min-w-0"
          >
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
                Document Information
              </h4>
              <button onClick={() => setShowDocInfo(false)} className="text-[#58413f]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] truncate">Filename: {doc.name}</p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">Format: .{doc.extension.toUpperCase()}</p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">Total Pages: {totalPages}</p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
              Encryption: {doc.isLocked ? 'Protected (Vault Cipher)' : 'Standard Offline'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHYSICAL DOCUMENT SHEET CONTAINER WITH ENTRANCE ANIMATION */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35, ease: 'easeOut' }}
        className={`relative w-full rounded-2xl retro-border retro-shadow-lg transition-all duration-200 overflow-hidden min-w-0 ${getThemeStyles()}`}
        style={{
          transformOrigin: 'top center',
          transform: `scale(${zoom / 100})`,
        }}
      >
        {/* Sheet Top Header / Marginalia */}
        <div className="px-4 py-3 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="px-2 py-0.5 text-white rounded font-heading font-bold text-[10px] uppercase shrink-0 transition-colors"
            >
              {doc.extension.toUpperCase()}
            </span>
            <span className="font-heading font-bold text-xs uppercase tracking-wide truncate">
              {doc.name}
            </span>
          </div>
          <span className="font-heading font-bold text-[11px] opacity-75 shrink-0">
            SEC 04.2
          </span>
        </div>

        {/* INNER CONTENT PAGE AREA */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 min-h-[450px] min-w-0">
          {doc.type === 'pdf' ? (
            /* Specialized Blob URL PdfViewer Component */
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentPage} 
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }} 
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center min-w-0 w-full"
              >
                <PdfViewer
                  document={doc}
                  currentPage={currentPage}
                  zoom={zoom}
                  fitMode={fitMode}
                  onLoadSuccess={handlePdfLoadSuccess}
                />
              </motion.div>
            </AnimatePresence>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-red)]" />
              <p className="font-heading font-bold text-xs uppercase tracking-wider opacity-70">
                Rendering Document Page...
              </p>
            </div>
          ) : doc.type === 'excel' ? (
            /* Spreadsheet Grid Renderer */
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeSheetIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4 min-w-0"
              >
                {spreadsheetSheets.length > 0 ? (
                  <>
                    <div className="flex items-center gap-1 border-b border-black/10 pb-2 overflow-x-auto no-scrollbar">
                      {spreadsheetSheets.map((sheet, index) => (
                        <button
                          key={sheet.name}
                          onClick={() => setActiveSheetIndex(index)}
                          style={{
                            backgroundColor: activeSheetIndex === index ? 'var(--primary-red)' : undefined,
                          }}
                          className={`px-3 py-1 rounded-lg font-heading font-bold text-xs uppercase cursor-pointer whitespace-nowrap shrink-0 ${
                            activeSheetIndex === index ? 'text-white' : 'bg-black/5 text-[#1d1c11]'
                          }`}
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-black/20">
                      <table className="w-full border-collapse text-xs font-mono">
                        <thead>
                          <tr className="bg-black/10">
                            {spreadsheetSheets[activeSheetIndex]?.headers.map((header, idx) => (
                              <th key={idx} className="p-2 border border-black/20 text-left font-bold whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {spreadsheetSheets[activeSheetIndex]?.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-black/5">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 border border-black/10 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div
                    className="prose max-w-none text-sm font-sans leading-relaxed break-words min-w-0"
                    dangerouslySetInnerHTML={{ __html: doc.content ? formatMarkdownToHtml(doc.content) : '<p>Spreadsheet data loaded.</p>' }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
           ) : doc.type === 'powerpoint' ? (
            /* Presentation Slide Viewer with Embedded Images */
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentPage}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4 min-w-0"
              >
                {slides.length > 0 ? (
                  <div className="p-5 sm:p-6 bg-black/5 rounded-2xl retro-border-sm flex flex-col gap-3 min-w-0">
                    <span style={{ color: 'var(--primary-red)' }} className="font-heading font-bold text-xs uppercase tracking-widest">
                      SLIDE {currentPage} OF {slides.length}
                    </span>
                    <h2 className="font-heading text-xl sm:text-2xl font-bold">
                      {slides[currentPage - 1]?.title || 'Slide Title'}
                    </h2>
                    
                    {/* Render embedded slide images if present */}
                    {slides[currentPage - 1]?.images && slides[currentPage - 1].images!.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
                        {slides[currentPage - 1].images!.map((imgSrc, imgIdx) => (
                          <div key={imgIdx} className="rounded-lg overflow-hidden retro-border-sm bg-white shadow-xs p-1">
                            <img
                              src={imgSrc}
                              alt={`Slide ${currentPage} graphic ${imgIdx + 1}`}
                              className="w-full h-auto object-contain max-h-[240px] rounded"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <ul className="flex flex-col gap-2">
                      {slides[currentPage - 1]?.bulletPoints.map((point, idx) => (
                        <li key={idx} className="font-sans text-sm flex items-start gap-2">
                          <span style={{ color: 'var(--primary-red)' }} className="font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div
                    className="prose max-w-none text-sm font-sans leading-relaxed break-words min-w-0"
                    dangerouslySetInnerHTML={{ __html: doc.content ? formatMarkdownToHtml(doc.content) : '<p>Slide presentation loaded.</p>' }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            /* Word HTML or Markdown / TXT rendering */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="prose max-w-none text-sm font-sans leading-relaxed break-words min-w-0"
              dangerouslySetInnerHTML={{
                __html: docxHtml || formattedTextHtml || (doc.content ? formatMarkdownToHtml(doc.content) : '<p class="text-sm font-sans">Document content loaded successfully.</p>'),
              }}
            />
          )}

          {/* Document Page Footer */}
          <div className="mt-6 pt-3 border-t border-black/10 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 opacity-75 min-w-0">
              <CheckCircle className="w-4 h-4 text-[#249B65] shrink-0" />
              <span className="font-heading font-bold text-[10px] uppercase tracking-wider truncate">
                Offline Verified • SHA-256
              </span>
            </div>
            <div className="px-2.5 py-1 rounded bg-black/5 font-heading text-xs font-bold shrink-0">
              – {currentPage} –
            </div>
          </div>
        </div>
      </motion.article>

      {/* Next Page Cue */}
      {currentPage < totalPages && (
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={handleNextPage}
          className="mt-4 mx-2 bg-[#ede8d6] dark:bg-[#3d3a30] rounded-xl p-3 retro-border-sm retro-shadow-sm flex items-center justify-between cursor-pointer hover:bg-[#e7e2d1] min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ArrowDown className="w-4 h-4 shrink-0" />
            <span className="font-sans text-xs font-medium truncate">Page {currentPage + 1}: Next Section</span>
          </div>
          <span className="font-heading font-bold text-[10px] px-2 py-0.5 rounded bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm shrink-0">
            NEXT
          </span>
        </motion.div>
      )}

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
              className="h-10 w-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const target = prompt(`Jump to page (1 - ${totalPages}):`, String(currentPage));
                if (target) {
                  const num = parseInt(target, 10);
                  if (!isNaN(num) && num >= 1 && num <= totalPages) {
                    setCurrentPage(num);
                    onUpdatePage(num, totalPages);
                  }
                }
              }}
              aria-label="Jump to page"
              className="h-10 sm:h-11 flex-1 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center gap-1.5 retro-border-sm retro-shadow-sm cursor-pointer min-w-0"
            >
              <BookOpen className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
              <span className="font-heading font-bold text-sm tracking-tight">{currentPage}</span>
              <span className="font-heading text-xs text-[#58413f] dark:text-[#c8bead]">/ {totalPages}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Next Page"
              className="h-10 w-10 sm:w-11 sm:h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const nextMode = fitMode === 'page' ? 'width' : 'page';
                setFitMode(nextMode);
                setZoom(nextMode === 'page' ? 100 : 85);
              }}
              aria-label="Toggle Fit Mode"
              className="h-10 sm:h-11 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] flex items-center justify-center gap-1 retro-border-sm retro-shadow-sm cursor-pointer shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="font-heading font-bold text-xs uppercase hidden sm:inline">{fitMode}</span>
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
              <span className="px-2 font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">{zoom}%</span>
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
                    onClick={() => setTheme(t.id as any)}
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
