import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutPanelTop, List } from 'lucide-react';
import { SlideItem } from '../../services/presentationService';

interface PptSlideViewerProps {
  slides: SlideItem[];
  currentPage: number;
  zoom: number;
  searchQuery?: string;
}

function highlightPlainText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const splitRegex = new RegExp(`(${escaped})`, 'gi');
  const exactRegex = new RegExp(`^${escaped}$`, 'i');
  return text.split(splitRegex).map((part, idx) =>
    exactRegex.test(part) ? (
      <mark key={idx} className="bg-yellow-300 text-[#1d1c11] px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export const PptSlideViewer: React.FC<PptSlideViewerProps> = ({
  slides,
  currentPage,
  zoom,
  searchQuery = '',
}) => {
  const [viewMode, setViewMode] = useState<'slide' | 'outline'>('slide');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidthPx, setStageWidthPx] = useState<number>(360);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) setStageWidthPx(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentPage, zoom, viewMode]);

  if (slides.length === 0) {
    return <p className="text-sm font-sans opacity-75">No slides found in deck.</p>;
  }

  const slide = slides[Math.min(Math.max(0, currentPage - 1), slides.length - 1)];
  const hasVisualCanvas = Boolean(slide.elements && slide.elements.length > 0);
  const effectiveMode = hasVisualCanvas ? viewMode : 'outline';

  // PowerPoint standard width in points (~960pt for 13.333in widescreen, ~720pt for 10in 4:3)
  const slideWidthInches = (slide.slideWidth || 12192000) / 914400;
  const slidePointsWide = Math.max(400, slideWidthInches * 72);
  const ptScale = stageWidthPx / slidePointsWide;

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full">
      {/* Header bar with Slide/Outline switch */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          style={{ color: 'var(--primary-red)' }}
          className="font-heading font-bold text-xs uppercase tracking-widest tabular-nums"
        >
          Slide {slide.slideNumber} of {slides.length}
        </span>

        {hasVisualCanvas && (
          <div className="inline-flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/10 retro-border-sm">
            <button
              type="button"
              onClick={() => setViewMode('slide')}
              style={{
                backgroundColor: effectiveMode === 'slide' ? 'var(--primary-red)' : undefined,
              }}
              className={`min-h-[34px] px-2.5 rounded-md font-heading font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                effectiveMode === 'slide' ? 'text-white' : 'text-inherit opacity-75'
              }`}
            >
              <LayoutPanelTop className="w-3.5 h-3.5" />
              <span>Slide View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('outline')}
              style={{
                backgroundColor: effectiveMode === 'outline' ? 'var(--primary-red)' : undefined,
              }}
              className={`min-h-[34px] px-2.5 rounded-md font-heading font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                effectiveMode === 'outline' ? 'text-white' : 'text-inherit opacity-75'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Text & Images</span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${slide.slideNumber}-${effectiveMode}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
          className="w-full min-w-0 flex flex-col gap-3"
        >
          {effectiveMode === 'slide' && slide.elements ? (
            <div className="w-full overflow-x-auto pb-1">
              <div
                ref={stageRef}
                style={{
                  width: `${zoom}%`,
                  minWidth: zoom <= 100 ? '100%' : undefined,
                  aspectRatio: `${slide.slideWidth || 16} / ${slide.slideHeight || 9}`,
                  backgroundColor: slide.backgroundColor || '#ffffff',
                  backgroundImage: slide.backgroundImage
                    ? `url(${slide.backgroundImage})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                className="relative rounded-xl retro-border-sm shadow-sm overflow-hidden text-[#1d1c11] mx-auto"
              >
                {slide.elements.map((el) => {
                  const baseStyle: React.CSSProperties = {
                    position: 'absolute',
                    left: `${el.xPct}%`,
                    top: `${el.yPct}%`,
                    width: `${el.wPct}%`,
                    height: `${el.hPct}%`,
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                    transformOrigin: 'center center',
                  };

                  if (el.kind === 'image' && el.imageUrl) {
                    return (
                      <div key={el.id} style={baseStyle} className="overflow-hidden">
                        <img
                          src={el.imageUrl}
                          alt={el.alt || `Slide ${slide.slideNumber} image`}
                          className="w-full h-full object-contain block"
                        />
                      </div>
                    );
                  }

                  if (el.kind === 'table' && el.tableRows) {
                    const cellFontPx = Math.max(8, Math.round(12 * ptScale));
                    return (
                      <div
                        key={el.id}
                        style={{ ...baseStyle, fontSize: `${cellFontPx}px` }}
                        className="overflow-auto bg-white/95 rounded border border-black/20"
                      >
                        <table className="w-full h-full border-collapse">
                          <tbody>
                            {el.tableRows.map((row, rIdx) => (
                              <tr key={rIdx} className={rIdx === 0 ? 'bg-black/8 font-bold' : ''}>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="border border-black/15 px-1.5 py-0.5 align-top break-words"
                                  >
                                    {highlightPlainText(cell, searchQuery)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  // Text / Shape element
                  return (
                    <div
                      key={el.id}
                      style={{
                        ...baseStyle,
                        backgroundColor: el.fillColor || undefined,
                        border: el.borderColor ? `1px solid ${el.borderColor}` : undefined,
                      }}
                      className="overflow-y-auto overflow-x-hidden px-1.5 py-0.5 flex flex-col justify-start"
                    >
                      {el.paragraphs?.map((para, pIdx) => {
                        const rawPt = para.fontSizePt || (para.isTitle ? 28 : 16);
                        const fontPx = Math.max(8.5, rawPt * ptScale);
                        return (
                          <p
                            key={pIdx}
                            style={{
                              fontSize: `${fontPx}px`,
                              lineHeight: 1.25,
                              textAlign: para.align || 'left',
                            }}
                            className="break-words my-[0.15em]"
                          >
                            {para.bullet && <span className="mr-1">{para.bullet}</span>}
                            {para.runs.map((run, rIdx) => (
                              <span
                                key={rIdx}
                                style={{
                                  fontWeight: run.bold ? 700 : 400,
                                  fontStyle: run.italic ? 'italic' : 'normal',
                                  color: run.color || (slide.backgroundColor === '#1d1c11' ? '#ffffff' : '#1d1c11'),
                                  fontSize: run.fontSizePt
                                    ? `${Math.max(8.5, run.fontSizePt * ptScale)}px`
                                    : undefined,
                                }}
                              >
                                {highlightPlainText(run.text, searchQuery)}
                              </span>
                            ))}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className="p-4 sm:p-6 bg-black/5 dark:bg-white/5 rounded-2xl retro-border-sm flex flex-col gap-3 min-w-0"
              style={{ fontSize: `${Math.round(14 * (zoom / 100))}px` }}
            >
              <h2 className="font-heading text-[1.35em] font-bold break-words">
                {highlightPlainText(slide.title, searchQuery)}
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
                        className="w-full h-auto object-contain max-h-[300px] rounded"
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
                      <span>{highlightPlainText(point, searchQuery)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Speaker Notes */}
          {slide.notes && (
            <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
              <span className="font-heading font-bold text-[10px] uppercase tracking-wider opacity-70 block mb-1">
                Speaker Notes
              </span>
              <p className="font-sans text-xs opacity-85 whitespace-pre-wrap break-words">
                {highlightPlainText(slide.notes, searchQuery)}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
