import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export interface SlideParagraphRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSizePt?: number;
}

export interface SlideParagraph {
  runs: SlideParagraphRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  bullet?: string;
  fontSizePt?: number;
  isTitle?: boolean;
}

export type SlideElementKind = 'shape' | 'image' | 'table';

export interface SlideElement {
  id: string;
  kind: SlideElementKind;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  rotation?: number;
  // Shape / text properties
  paragraphs?: SlideParagraph[];
  fillColor?: string;
  borderColor?: string;
  isPlaceholderTitle?: boolean;
  // Image properties
  imageUrl?: string;
  alt?: string;
  // Table properties
  tableRows?: string[][];
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
  images: string[];
  notes?: string;
  // Positioned canvas geometry for original PowerPoint layout rendering
  slideWidth?: number;
  slideHeight?: number;
  backgroundColor?: string;
  backgroundImage?: string;
  elements?: SlideElement[];
}

const IMAGE_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const DEFAULT_SLIDE_W = 12192000; // 16:9 widescreen EMUs (13.333 in)
const DEFAULT_SLIDE_H = 6858000;  // 7.5 in

const THEME_FALLBACK_COLORS: Record<string, string> = {
  dk1: '#1d1c11',
  tx1: '#1d1c11',
  lt1: '#ffffff',
  bg1: '#ffffff',
  dk2: '#334155',
  tx2: '#334155',
  lt2: '#f4f4f5',
  bg2: '#f4f4f5',
  accent1: '#2563eb',
  accent2: '#dc2626',
  accent3: '#16a34a',
  accent4: '#9333ea',
  accent5: '#0891b2',
  accent6: '#ea580c',
};

interface XfrmBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

interface LayoutData {
  placeholdersByKey: Map<string, XfrmBox>;
  decorElements: SlideElement[];
  backgroundColor?: string;
  backgroundImage?: string;
}

function normalizeZipRelTarget(baseDir: string, target: string): string {
  if (!target) return '';
  let cleanTarget = target.replace(/\\/g, '/').trim();
  try {
    cleanTarget = decodeURIComponent(cleanTarget);
  } catch {
    // keep raw if malformed URI encoding
  }
  if (cleanTarget.startsWith('/')) {
    return cleanTarget.slice(1);
  }
  const parts = (baseDir ? `${baseDir}/${cleanTarget}` : cleanTarget).split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

function getDirectChildrenByLocalName(parent: Element | null, localName: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((ch) => ch.localName === localName);
}

function getFirstChildByLocalName(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  for (const ch of Array.from(parent.children)) {
    if (ch.localName === localName) return ch;
  }
  return null;
}

function getFirstDescendantByLocalName(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  const all = Array.from(parent.getElementsByTagName('*'));
  return all.find((el) => el.localName === localName) || null;
}

function extractColorFromContainer(container: Element | null): string | undefined {
  if (!container) return undefined;
  const solidFill =
    container.localName === 'solidFill'
      ? container
      : getFirstChildByLocalName(container, 'solidFill');
  if (!solidFill) return undefined;

  const srgb = getFirstChildByLocalName(solidFill, 'srgbClr');
  if (srgb) {
    const val = srgb.getAttribute('val');
    if (val && /^[0-9a-fA-F]{6}$/.test(val)) {
      return `#${val}`;
    }
  }
  const scheme = getFirstChildByLocalName(solidFill, 'schemeClr');
  if (scheme) {
    const val = scheme.getAttribute('val') || '';
    return THEME_FALLBACK_COLORS[val];
  }
  return undefined;
}

function parseXfrm(node: Element | null): XfrmBox | null {
  if (!node) return null;
  const spPr = node.localName === 'xfrm' ? null : getFirstChildByLocalName(node, 'spPr');
  const xfrm = node.localName === 'xfrm' ? node : getFirstChildByLocalName(spPr || node, 'xfrm');
  if (!xfrm) return null;

  const off = getFirstChildByLocalName(xfrm, 'off');
  const ext = getFirstChildByLocalName(xfrm, 'ext');
  if (!off || !ext) return null;

  const x = parseInt(off.getAttribute('x') || '0', 10);
  const y = parseInt(off.getAttribute('y') || '0', 10);
  const w = parseInt(ext.getAttribute('cx') || '0', 10);
  const h = parseInt(ext.getAttribute('cy') || '0', 10);
  const rotRaw = parseInt(xfrm.getAttribute('rot') || '0', 10);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  return { x, y, w, h, rot: Math.round(rotRaw / 60000) };
}

function getEmbedRelId(el: Element): string {
  const blip = el.localName === 'blip' ? el : getFirstDescendantByLocalName(el, 'blip');
  if (blip) {
    for (const attr of Array.from(blip.attributes)) {
      if (attr.localName === 'embed' || attr.name === 'r:embed') {
        return attr.value;
      }
      if (attr.localName === 'link' || attr.name === 'r:link') {
        return attr.value;
      }
    }
  }
  const imagedata = getFirstDescendantByLocalName(el, 'imagedata');
  if (imagedata) {
    return imagedata.getAttribute('r:id') || imagedata.getAttribute('id') || '';
  }
  return '';
}

function parseParagraphsRich(txBody: Element | null, isTitlePlaceholder = false): SlideParagraph[] {
  if (!txBody) return [];
  const pNodes = getDirectChildrenByLocalName(txBody, 'p');
  const out: SlideParagraph[] = [];

  for (const p of pNodes) {
    const pPr = getFirstChildByLocalName(p, 'pPr');
    const algnRaw = pPr?.getAttribute('algn') || '';
    const align: SlideParagraph['align'] =
      algnRaw === 'ctr'
        ? 'center'
        : algnRaw === 'r'
        ? 'right'
        : algnRaw === 'just'
        ? 'justify'
        : 'left';

    let bullet: string | undefined;
    if (pPr) {
      const buNone = getFirstChildByLocalName(pPr, 'buNone');
      if (!buNone) {
        const buChar = getFirstChildByLocalName(pPr, 'buChar');
        const buAutoNum = getFirstChildByLocalName(pPr, 'buAutoNum');
        if (buChar) {
          bullet = buChar.getAttribute('char') || '•';
        } else if (buAutoNum) {
          bullet = '•';
        }
      }
    }

    const runs: SlideParagraphRun[] = [];
    for (const child of Array.from(p.children)) {
      if (child.localName === 'r' || child.localName === 'fld') {
        const tEl = getFirstChildByLocalName(child, 't');
        const txt = tEl?.textContent ?? '';
        if (!txt) continue;

        const rPr = getFirstChildByLocalName(child, 'rPr');
        const szRaw = rPr?.getAttribute('sz');
        const fontSizePt = szRaw ? Math.round(parseInt(szRaw, 10) / 100) : undefined;
        const bold = rPr?.getAttribute('b') === '1' || rPr?.getAttribute('b') === 'true' || isTitlePlaceholder;
        const italic = rPr?.getAttribute('i') === '1' || rPr?.getAttribute('i') === 'true';
        const color = extractColorFromContainer(rPr);

        runs.push({ text: txt, bold, italic, color, fontSizePt });
      } else if (child.localName === 'br') {
        runs.push({ text: '\n' });
      }
    }

    const fullText = runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
    if (!fullText) continue;

    const firstFontPt = runs.find((r) => r.fontSizePt)?.fontSizePt;
    out.push({
      runs,
      align,
      bullet,
      fontSizePt: firstFontPt || (isTitlePlaceholder ? 28 : undefined),
      isTitle: isTitlePlaceholder,
    });
  }

  return out;
}

async function loadRelationshipMap(
  zip: JSZip,
  relsPath: string,
  baseDir: string,
  mediaMapLower: Record<string, string>,
  parser: DOMParser
): Promise<{
  rIdToTarget: Map<string, string>;
  rIdToImage: Map<string, string>;
  allImages: string[];
  notesPath?: string;
  layoutPath?: string;
  masterPath?: string;
  diagramDrawingPaths: string[];
}> {
  const rIdToTarget = new Map<string, string>();
  const rIdToImage = new Map<string, string>();
  const allImages: string[] = [];
  const diagramDrawingPaths: string[] = [];
  let notesPath: string | undefined;
  let layoutPath: string | undefined;
  let masterPath: string | undefined;

  const relsFile = findZipFileCaseInsensitive(zip, relsPath);
  if (!relsFile) {
    return { rIdToTarget, rIdToImage, allImages, diagramDrawingPaths };
  }

  const relsXml = await relsFile.async('text');
  const relsDoc = parser.parseFromString(relsXml, 'text/xml');
  const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));

  for (const rel of relationships) {
    const id = rel.getAttribute('Id') || '';
    const target = rel.getAttribute('Target') || '';
    const type = rel.getAttribute('Type') || '';
    const targetMode = rel.getAttribute('TargetMode') || '';
    if (targetMode.toLowerCase() === 'external') continue;

    const resolved = normalizeZipRelTarget(baseDir, target);
    const resolvedLower = resolved.toLowerCase();
    rIdToTarget.set(id, resolved);

    if (type.includes('/image') && mediaMapLower[resolvedLower]) {
      const imgUrl = mediaMapLower[resolvedLower];
      rIdToImage.set(id, imgUrl);
      allImages.push(imgUrl);
    } else if (type.includes('/notesSlide')) {
      notesPath = resolved;
    } else if (type.includes('/slideLayout')) {
      layoutPath = resolved;
    } else if (type.includes('/slideMaster')) {
      masterPath = resolved;
    } else if (
      type.includes('diagramDrawing') ||
      resolvedLower.includes('/diagrams/drawing')
    ) {
      diagramDrawingPaths.push(resolved);
    }
  }

  return {
    rIdToTarget,
    rIdToImage,
    allImages,
    notesPath,
    layoutPath,
    masterPath,
    diagramDrawingPaths,
  };
}

function findZipFileCaseInsensitive(zip: JSZip, targetPath: string): JSZip.JSZipObject | undefined {
  if (zip.files[targetPath]) return zip.files[targetPath];
  const lower = targetPath.toLowerCase();
  const matchedKey = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
  return matchedKey ? zip.files[matchedKey] : undefined;
}

function toRelsPath(partPath: string): { relsPath: string; baseDir: string } {
  const parts = partPath.split('/');
  const fileName = parts.pop() || '';
  const baseDir = parts.join('/');
  return {
    relsPath: baseDir ? `${baseDir}/_rels/${fileName}.rels` : `_rels/${fileName}.rels`,
    baseDir,
  };
}

function parseSpTreeElements(
  spTree: Element | null,
  slideW: number,
  slideH: number,
  rIdToImage: Map<string, string>,
  placeholders: Map<string, XfrmBox> | null,
  options: {
    prefix: string;
    collectPlaceholdersInto?: Map<string, XfrmBox>;
    skipPlaceholders?: boolean;
    parentOffset?: { x: number; y: number; scaleX: number; scaleY: number };
  }
): SlideElement[] {
  if (!spTree) return [];
  const elements: SlideElement[] = [];
  let idx = 0;

  const mapBox = (box: XfrmBox): { xPct: number; yPct: number; wPct: number; hPct: number; rot: number } => {
    const scaleX = options.parentOffset?.scaleX ?? 1;
    const scaleY = options.parentOffset?.scaleY ?? 1;
    const offX = options.parentOffset?.x ?? 0;
    const offY = options.parentOffset?.y ?? 0;

    const absX = offX + box.x * scaleX;
    const absY = offY + box.y * scaleY;
    const absW = box.w * scaleX;
    const absH = box.h * scaleY;

    return {
      xPct: Math.max(0, Math.min(98, (absX / slideW) * 100)),
      yPct: Math.max(0, Math.min(98, (absY / slideH) * 100)),
      wPct: Math.max(2, Math.min(100, (absW / slideW) * 100)),
      hPct: Math.max(2, Math.min(100, (absH / slideH) * 100)),
      rot: box.rot,
    };
  };

  for (const child of Array.from(spTree.children)) {
    const tag = child.localName;
    idx++;

    if (tag === 'grpSp') {
      const grpSpPr = getFirstChildByLocalName(child, 'grpSpPr');
      const grpXfrm = parseXfrm(grpSpPr);
      const xfrmNode = getFirstChildByLocalName(grpSpPr, 'xfrm');
      const chOff = getFirstChildByLocalName(xfrmNode, 'chOff');
      const chExt = getFirstChildByLocalName(xfrmNode, 'chExt');

      let childMapping = options.parentOffset;
      if (grpXfrm && chOff && chExt) {
        const chW = Math.max(1, parseInt(chExt.getAttribute('cx') || '1', 10));
        const chH = Math.max(1, parseInt(chExt.getAttribute('cy') || '1', 10));
        const chX = parseInt(chOff.getAttribute('x') || '0', 10);
        const chY = parseInt(chOff.getAttribute('y') || '0', 10);
        const sx = grpXfrm.w / chW;
        const sy = grpXfrm.h / chH;
        childMapping = {
          x: grpXfrm.x - chX * sx,
          y: grpXfrm.y - chY * sy,
          scaleX: sx,
          scaleY: sy,
        };
      }

      const nested = parseSpTreeElements(child, slideW, slideH, rIdToImage, placeholders, {
        ...options,
        prefix: `${options.prefix}-g${idx}`,
        parentOffset: childMapping,
      });
      elements.push(...nested);
      continue;
    }

    if (tag === 'pic') {
      const spPr = getFirstChildByLocalName(child, 'spPr');
      const nvPicPr = getFirstChildByLocalName(child, 'nvPicPr');
      const nvPr = getFirstChildByLocalName(nvPicPr, 'nvPr');
      const ph = getFirstChildByLocalName(nvPr, 'ph');
      const phKey = ph
        ? `${ph.getAttribute('type') || 'obj'}:${ph.getAttribute('idx') || '0'}`
        : '';

      const box = parseXfrm(spPr) || (phKey ? placeholders?.get(phKey) || placeholders?.get(ph?.getAttribute('type') || '') || null : null);
      if (ph && box && options.collectPlaceholdersInto) {
        options.collectPlaceholdersInto.set(phKey, box);
      }
      if (ph && options.skipPlaceholders) continue;

      const rId = getEmbedRelId(child);
      const imageUrl = rId ? rIdToImage.get(rId) : undefined;
      if (!imageUrl) continue;

      const cNvPr = getFirstChildByLocalName(nvPicPr, 'cNvPr');
      const alt = cNvPr?.getAttribute('descr') || cNvPr?.getAttribute('name') || 'Slide image';

      const mapped = box
        ? mapBox(box)
        : { xPct: 8, yPct: 18, wPct: 84, hPct: 64, rot: 0 };

      elements.push({
        id: `${options.prefix}-pic-${idx}`,
        kind: 'image',
        ...mapped,
        imageUrl,
        alt,
      });
      continue;
    }

    if (tag === 'sp') {
      const nvSpPr = getFirstChildByLocalName(child, 'nvSpPr');
      const nvPr = getFirstChildByLocalName(nvSpPr, 'nvPr');
      const ph = getFirstChildByLocalName(nvPr, 'ph');
      const phType = ph?.getAttribute('type') || '';
      const phIdx = ph?.getAttribute('idx') || '';
      const phKey = ph ? `${phType}:${phIdx}` : '';

      const spPr = getFirstChildByLocalName(child, 'spPr');
      let box = parseXfrm(spPr);
      if (!box && ph && placeholders) {
        box =
          placeholders.get(phKey) ||
          placeholders.get(`${phType}:`) ||
          placeholders.get(`:${phIdx}`) ||
          placeholders.get(phType) ||
          null;
      }

      if (ph && box && options.collectPlaceholdersInto) {
        options.collectPlaceholdersInto.set(phKey, box);
        if (phType) options.collectPlaceholdersInto.set(phType, box);
        if (phIdx) options.collectPlaceholdersInto.set(`:${phIdx}`, box);
      }

      if (ph && options.skipPlaceholders) continue;

      const isTitlePlaceholder = phType === 'title' || phType === 'ctrTitle';
      const txBody = getFirstChildByLocalName(child, 'txBody');
      const paragraphs = parseParagraphsRich(txBody, isTitlePlaceholder);

      // Also check if shape uses a blipFill image background inside a shape!
      const blipFill = getFirstChildByLocalName(spPr, 'blipFill');
      if (blipFill) {
        const rId = getEmbedRelId(blipFill);
        const imgUrl = rId ? rIdToImage.get(rId) : undefined;
        if (imgUrl && box) {
          elements.push({
            id: `${options.prefix}-spimg-${idx}`,
            kind: 'image',
            ...mapBox(box),
            imageUrl: imgUrl,
            alt: 'Slide graphic',
          });
        }
      }

      const fillColor = extractColorFromContainer(spPr);
      const lnNode = getFirstChildByLocalName(spPr, 'ln');
      const borderColor = extractColorFromContainer(lnNode);

      if (paragraphs.length === 0 && !fillColor) continue;

      const mapped = box
        ? mapBox(box)
        : isTitlePlaceholder
        ? { xPct: 6, yPct: 6, wPct: 88, hPct: 16, rot: 0 }
        : { xPct: 6, yPct: 24, wPct: 88, hPct: 65, rot: 0 };

      elements.push({
        id: `${options.prefix}-sp-${idx}`,
        kind: 'shape',
        ...mapped,
        paragraphs,
        fillColor,
        borderColor,
        isPlaceholderTitle: isTitlePlaceholder,
      });
      continue;
    }

    if (tag === 'graphicFrame') {
      const box = parseXfrm(child);
      const tbl = getFirstDescendantByLocalName(child, 'tbl');
      if (tbl) {
        const trs = getDirectChildrenByLocalName(tbl, 'tr');
        const tableRows: string[][] = trs.map((tr) =>
          getDirectChildrenByLocalName(tr, 'tc').map((tc) => {
            const pNodes = Array.from(tc.getElementsByTagName('*')).filter(
              (el) => el.localName === 't'
            );
            return pNodes.map((n) => n.textContent || '').join('').trim();
          })
        );
        if (tableRows.length > 0) {
          const mapped = box
            ? mapBox(box)
            : { xPct: 6, yPct: 22, wPct: 88, hPct: 60, rot: 0 };
          elements.push({
            id: `${options.prefix}-tbl-${idx}`,
            kind: 'table',
            ...mapped,
            tableRows,
          });
        }
      }
    }
  }

  return elements;
}

function parseBackground(
  rootDoc: Document,
  rIdToImage: Map<string, string>
): { backgroundColor?: string; backgroundImage?: string } {
  const cSld = getFirstDescendantByLocalName(rootDoc.documentElement, 'cSld');
  const bg = getFirstChildByLocalName(cSld, 'bg');
  if (!bg) return {};

  const bgPr = getFirstChildByLocalName(bg, 'bgPr');
  if (bgPr) {
    const backgroundColor = extractColorFromContainer(bgPr);
    const blipFill = getFirstChildByLocalName(bgPr, 'blipFill');
    if (blipFill) {
      const rId = getEmbedRelId(blipFill);
      const backgroundImage = rId ? rIdToImage.get(rId) : undefined;
      return { backgroundColor, backgroundImage };
    }
    return { backgroundColor };
  }

  const bgRef = getFirstChildByLocalName(bg, 'bgRef');
  if (bgRef) {
    const srgb = getFirstChildByLocalName(bgRef, 'srgbClr');
    if (srgb?.getAttribute('val')) {
      return { backgroundColor: `#${srgb.getAttribute('val')}` };
    }
  }
  return {};
}

async function parseLayoutAndMaster(
  zip: JSZip,
  layoutPath: string,
  slideW: number,
  slideH: number,
  mediaMapLower: Record<string, string>,
  parser: DOMParser,
  cache: Map<string, LayoutData>
): Promise<LayoutData> {
  if (cache.has(layoutPath)) return cache.get(layoutPath)!;

  const placeholdersByKey = new Map<string, XfrmBox>();
  const decorElements: SlideElement[] = [];
  let backgroundColor: string | undefined;
  let backgroundImage: string | undefined;

  const { relsPath, baseDir } = toRelsPath(layoutPath);
  const rels = await loadRelationshipMap(zip, relsPath, baseDir, mediaMapLower, parser);

  if (rels.masterPath) {
    const masterFile = findZipFileCaseInsensitive(zip, rels.masterPath);
    if (masterFile) {
      const masterMeta = toRelsPath(rels.masterPath);
      const masterRels = await loadRelationshipMap(
        zip,
        masterMeta.relsPath,
        masterMeta.baseDir,
        mediaMapLower,
        parser
      );
      const masterDoc = parser.parseFromString(await masterFile.async('text'), 'text/xml');
      const masterBg = parseBackground(masterDoc, masterRels.rIdToImage);
      backgroundColor = masterBg.backgroundColor;
      backgroundImage = masterBg.backgroundImage;
      const masterTree = getFirstDescendantByLocalName(masterDoc.documentElement, 'spTree');
      parseSpTreeElements(masterTree, slideW, slideH, masterRels.rIdToImage, null, {
        prefix: 'master',
        collectPlaceholdersInto: placeholdersByKey,
        skipPlaceholders: true,
      });
    }
  }

  const layoutFile = findZipFileCaseInsensitive(zip, layoutPath);
  if (layoutFile) {
    const layoutDoc = parser.parseFromString(await layoutFile.async('text'), 'text/xml');
    const layoutBg = parseBackground(layoutDoc, rels.rIdToImage);
    backgroundColor = layoutBg.backgroundColor || backgroundColor;
    backgroundImage = layoutBg.backgroundImage || backgroundImage;

    const layoutTree = getFirstDescendantByLocalName(layoutDoc.documentElement, 'spTree');
    const layoutDecors = parseSpTreeElements(
      layoutTree,
      slideW,
      slideH,
      rels.rIdToImage,
      placeholdersByKey,
      {
        prefix: 'layout',
        collectPlaceholdersInto: placeholdersByKey,
        skipPlaceholders: true,
      }
    );
    decorElements.push(...layoutDecors);
  }

  const result: LayoutData = {
    placeholdersByKey,
    decorElements,
    backgroundColor,
    backgroundImage,
  };
  cache.set(layoutPath, result);
  return result;
}

export async function parsePptxArrayBuffer(
  buffer: Uint8Array | ArrayBuffer
): Promise<SlideItem[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides: SlideItem[] = [];
    const parser = new DOMParser();

    // Load ALL media images from ppt/media/* or any embedded media folder
    const mediaMapLower: Record<string, string> = {};
    for (const path of Object.keys(zip.files)) {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      if (/^(ppt\/media\/|Pictures\/|media\/)/i.test(path) && IMAGE_MIME_MAP[ext]) {
        try {
          const b64 = await zip.files[path].async('base64');
          mediaMapLower[path.toLowerCase()] = `data:${IMAGE_MIME_MAP[ext]};base64,${b64}`;
        } catch (err) {
          console.warn(`Skipped media ${path}:`, err);
        }
      }
    }

    // OpenDocument Presentation (.odp)
    if (zip.files['content.xml'] && !zip.files['ppt/presentation.xml']) {
      return await parseOdpFromZip(zip);
    }

    // Determine slide dimensions & presentation order from ppt/presentation.xml
    let slideW = DEFAULT_SLIDE_W;
    let slideH = DEFAULT_SLIDE_H;
    const orderedSlidePaths: string[] = [];

    const presFile = findZipFileCaseInsensitive(zip, 'ppt/presentation.xml');
    const presRelsFile = findZipFileCaseInsensitive(zip, 'ppt/_rels/presentation.xml.rels');

    if (presFile) {
      const presDoc = parser.parseFromString(await presFile.async('text'), 'text/xml');
      const sldSz = getFirstDescendantByLocalName(presDoc.documentElement, 'sldSz');
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute('cx') || '0', 10);
        const cy = parseInt(sldSz.getAttribute('cy') || '0', 10);
        if (cx > 0 && cy > 0) {
          slideW = cx;
          slideH = cy;
        }
      }

      if (presRelsFile) {
        const presRels = await loadRelationshipMap(
          zip,
          'ppt/_rels/presentation.xml.rels',
          'ppt',
          mediaMapLower,
          parser
        );
        const sldIds = Array.from(presDoc.getElementsByTagName('*')).filter(
          (el) => el.localName === 'sldId'
        );
        for (const sldId of sldIds) {
          const rId = sldId.getAttribute('r:id') || sldId.getAttribute('id') || '';
          const target = presRels.rIdToTarget.get(rId);
          if (target && findZipFileCaseInsensitive(zip, target)) {
            orderedSlidePaths.push(target);
          }
        }
      }
    }

    // Fallback to numeric filename sort if presentation.xml lacked sldIdList
    const slideFiles =
      orderedSlidePaths.length > 0
        ? orderedSlidePaths
        : Object.keys(zip.files)
            .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
            .sort((a, b) => {
              const numA = parseInt(a.match(/slide(\d+)\.xml$/i)?.[1] || '0', 10);
              const numB = parseInt(b.match(/slide(\d+)\.xml$/i)?.[1] || '0', 10);
              return numA - numB;
            });

    const layoutCache = new Map<string, LayoutData>();

    for (let i = 0; i < slideFiles.length; i++) {
      const filePath = slideFiles[i];
      const slideNum = i + 1;
      const slideObj = findZipFileCaseInsensitive(zip, filePath);
      if (!slideObj) continue;

      const xmlString = await slideObj.async('text');
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      const { relsPath, baseDir } = toRelsPath(filePath);
      const relInfo = await loadRelationshipMap(
        zip,
        relsPath,
        baseDir,
        mediaMapLower,
        parser
      );

      let layoutData: LayoutData | null = null;
      if (relInfo.layoutPath) {
        layoutData = await parseLayoutAndMaster(
          zip,
          relInfo.layoutPath,
          slideW,
          slideH,
          mediaMapLower,
          parser,
          layoutCache
        );
      }

      const slideBg = parseBackground(xmlDoc, relInfo.rIdToImage);
      const backgroundColor = slideBg.backgroundColor || layoutData?.backgroundColor || '#ffffff';
      const backgroundImage = slideBg.backgroundImage || layoutData?.backgroundImage;

      const spTree = getFirstDescendantByLocalName(xmlDoc.documentElement, 'spTree');
      const slideElements = parseSpTreeElements(
        spTree,
        slideW,
        slideH,
        relInfo.rIdToImage,
        layoutData?.placeholdersByKey || null,
        { prefix: `s${slideNum}` }
      );

      // Parse SmartArt / Diagram drawings linked to this slide
      for (const drawingPath of relInfo.diagramDrawingPaths) {
        const drawingFile = findZipFileCaseInsensitive(zip, drawingPath);
        if (!drawingFile) continue;
        const drawingMeta = toRelsPath(drawingPath);
        const drawingRels = await loadRelationshipMap(
          zip,
          drawingMeta.relsPath,
          drawingMeta.baseDir,
          mediaMapLower,
          parser
        );
        const drawingDoc = parser.parseFromString(await drawingFile.async('text'), 'text/xml');
        const drawingTree = getFirstDescendantByLocalName(drawingDoc.documentElement, 'spTree');
        const diagramEls = parseSpTreeElements(
          drawingTree,
          slideW,
          slideH,
          drawingRels.rIdToImage,
          null,
          { prefix: `s${slideNum}-diag` }
        );
        slideElements.push(...diagramEls);
      }

      // Combine non-placeholder layout graphics beneath slide shapes
      const combinedElements: SlideElement[] = [
        ...(layoutData?.decorElements || []),
        ...slideElements,
      ];

      // Build plain-text title, bulletPoints & images list for outline/notes/search fallback
      const allParagraphStrings: string[] = [];
      for (const el of slideElements) {
        if (el.paragraphs) {
          for (const p of el.paragraphs) {
            const line = p.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
            if (line) allParagraphStrings.push(line);
          }
        }
        if (el.tableRows) {
          for (const row of el.tableRows) {
            const joined = row.filter(Boolean).join(' | ');
            if (joined) allParagraphStrings.push(joined);
          }
        }
      }

      const imageSet = new Set<string>(relInfo.allImages);
      for (const el of combinedElements) {
        if (el.kind === 'image' && el.imageUrl) {
          imageSet.add(el.imageUrl);
        }
      }
      if (backgroundImage) {
        imageSet.add(backgroundImage);
      }

      // Speaker notes
      let notes: string | undefined;
      if (relInfo.notesPath) {
        const notesObj = findZipFileCaseInsensitive(zip, relInfo.notesPath);
        if (notesObj) {
          const notesDoc = parser.parseFromString(await notesObj.async('text'), 'text/xml');
          const noteParas = Array.from(notesDoc.getElementsByTagName('*'))
            .filter((el) => el.localName === 'p')
            .map((p) =>
              Array.from(p.getElementsByTagName('*'))
                .filter((ch) => ch.localName === 't')
                .map((ch) => ch.textContent || '')
                .join('')
                .replace(/\s+/g, ' ')
                .trim()
            )
            .filter((t) => t.length > 0 && !/^\d+$/.test(t));
          if (noteParas.length > 0) {
            notes = noteParas.join('\n');
          }
        }
      }

      const title = allParagraphStrings[0] || `Slide ${slideNum}`;
      const bulletPoints =
        allParagraphStrings.length > 1 ? allParagraphStrings.slice(1) : [];

      slides.push({
        slideNumber: slideNum,
        title,
        bulletPoints,
        images: Array.from(imageSet),
        notes,
        slideWidth: slideW,
        slideHeight: slideH,
        backgroundColor,
        backgroundImage,
        elements: combinedElements,
      });
    }

    if (slides.length > 0) return slides;
  } catch (error) {
    console.warn('PPTX zip parsing fallback engaged:', error);
  }

  // Legacy OLE2 binary .ppt files (PowerPoint 97-2003) via CFB
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return extractLegacyPptSlides(bytes);
  }

  return [
    {
      slideNumber: 1,
      title: 'Presentation Loaded',
      bulletPoints: ['No slide XML entries were found in this presentation file.'],
      images: [],
    },
  ];
}

async function parseOdpFromZip(zip: JSZip): Promise<SlideItem[]> {
  const xmlText = await zip.files['content.xml'].async('text');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const mediaMap: Record<string, string> = {};
  for (const path of Object.keys(zip.files)) {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (/^Pictures\//i.test(path) && IMAGE_MIME_MAP[ext]) {
      const b64 = await zip.files[path].async('base64');
      mediaMap[path] = `data:${IMAGE_MIME_MAP[ext]};base64,${b64}`;
      mediaMap[path.toLowerCase()] = mediaMap[path];
    }
  }

  const pages = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'page');
  return pages.map((page, idx) => {
    const texts: string[] = [];
    const images: string[] = [];
    for (const child of Array.from(page.getElementsByTagName('*'))) {
      if (child.localName === 'p' || child.localName === 'h') {
        const t = child.textContent?.replace(/\s+/g, ' ').trim();
        if (t) texts.push(t);
      } else if (child.localName === 'image') {
        const href = child.getAttribute('xlink:href') || child.getAttribute('href') || '';
        const imgUrl = mediaMap[href] || mediaMap[href.toLowerCase()];
        if (imgUrl) images.push(imgUrl);
      }
    }
    return {
      slideNumber: idx + 1,
      title: texts[0] || `Slide ${idx + 1}`,
      bulletPoints: texts.slice(1),
      images,
    };
  });
}

function uint8ToDataUriSafe(chunk: Uint8Array, mime: string): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < chunk.length; i += step) {
    binary += String.fromCharCode(...chunk.subarray(i, i + step));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Extracts embedded PNG, JPEG, and GIF images from a legacy PowerPoint Pictures stream.
 */
function extractImagesFromLegacyPicturesStream(picBytes: Uint8Array): string[] {
  const images: string[] = [];
  let i = 0;
  while (i < picBytes.length - 12 && images.length < 40) {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      picBytes[i] === 0x89 &&
      picBytes[i + 1] === 0x50 &&
      picBytes[i + 2] === 0x4e &&
      picBytes[i + 3] === 0x47
    ) {
      // Find PNG IEND chunk: 49 45 4E 44 AE 42 60 82
      let end = -1;
      for (let j = i + 8; j < picBytes.length - 7; j++) {
        if (
          picBytes[j] === 0x49 &&
          picBytes[j + 1] === 0x45 &&
          picBytes[j + 2] === 0x4e &&
          picBytes[j + 3] === 0x44
        ) {
          end = Math.min(picBytes.length, j + 8);
          break;
        }
      }
      if (end > i + 16) {
        images.push(uint8ToDataUriSafe(picBytes.subarray(i, end), 'image/png'));
        i = end;
        continue;
      }
    }

    // JPEG signature: FF D8 FF (E0/E1/DB/EE)
    if (picBytes[i] === 0xff && picBytes[i + 1] === 0xd8 && picBytes[i + 2] === 0xff) {
      let end = -1;
      for (let j = i + 4; j < picBytes.length - 1; j++) {
        if (picBytes[j] === 0xff && picBytes[j + 1] === 0xd9) {
          end = j + 2;
          break;
        }
      }
      if (end > i + 64) {
        images.push(uint8ToDataUriSafe(picBytes.subarray(i, end), 'image/jpeg'));
        i = end;
        continue;
      }
    }

    i++;
  }
  return images;
}

/**
 * Parses legacy binary PowerPoint 97-2003 (.ppt) OLE2 streams using XLSX.CFB:
 * extracts Unicode TextCharsAtom (0x0FA0), ASCII TextBytesAtom (0x0FA8),
 * grouped per Slide record (0x03EE), plus embedded Pictures stream images.
 */
function extractLegacyPptSlides(bytes: Uint8Array): SlideItem[] {
  const slides: SlideItem[] = [];
  let extractedImages: string[] = [];

  try {
    const cfb = XLSX.CFB.read(bytes, { type: 'array' });
    const picEntry = XLSX.CFB.find(cfb, '/Pictures');
    if (picEntry && picEntry.content) {
      const picBytes =
        picEntry.content instanceof Uint8Array
          ? picEntry.content
          : new Uint8Array(picEntry.content);
      extractedImages = extractImagesFromLegacyPicturesStream(picBytes);
    }

    const docEntry = XLSX.CFB.find(cfb, '/PowerPoint Document');
    if (docEntry && docEntry.content) {
      const stream =
        docEntry.content instanceof Uint8Array
          ? docEntry.content
          : new Uint8Array(docEntry.content);
      const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);

      const utf16Decoder = new TextDecoder('utf-16le', { fatal: false });
      const latinDecoder = new TextDecoder('latin1', { fatal: false });

      let currentTexts: string[] = [];
      let offset = 0;

      while (offset + 8 <= stream.length) {
        const verInst = view.getUint16(offset, true);
        const recVer = verInst & 0x0f;
        const recType = view.getUint16(offset + 2, true);
        const recLen = view.getUint32(offset + 4, true);

        if (recLen > stream.length - (offset + 8)) {
          offset += 1;
          continue;
        }

        // Slide container record (0x03EE) starts a new slide bucket when current has text
        if (recType === 0x03ee && currentTexts.length > 0) {
          slides.push({
            slideNumber: slides.length + 1,
            title: currentTexts[0],
            bulletPoints: currentTexts.slice(1),
            images: slides.length === 0 ? extractedImages : [],
          });
          currentTexts = [];
        }

        // TextCharsAtom (0x0FA0 = UTF-16LE)
        if (recType === 0x0fa0 && recLen > 0) {
          const text = utf16Decoder
            .decode(stream.subarray(offset + 8, offset + 8 + recLen))
            .replace(/\r/g, '\n');
          for (const line of text.split('\n')) {
            const clean = line.replace(/\s+/g, ' ').trim();
            if (clean.length > 1) currentTexts.push(clean);
          }
        }
        // TextBytesAtom (0x0FA8 = ASCII / Latin1)
        else if (recType === 0x0fa8 && recLen > 0) {
          const text = latinDecoder
            .decode(stream.subarray(offset + 8, offset + 8 + recLen))
            .replace(/\r/g, '\n');
          for (const line of text.split('\n')) {
            const clean = line.replace(/\s+/g, ' ').trim();
            if (clean.length > 1) currentTexts.push(clean);
          }
        }

        // Container record (recVer === 0xF) -> descend into children; atom -> skip recLen
        offset += recVer === 0x0f ? 8 : 8 + recLen;
      }

      if (currentTexts.length > 0) {
        slides.push({
          slideNumber: slides.length + 1,
          title: currentTexts[0],
          bulletPoints: currentTexts.slice(1),
          images: slides.length === 0 ? extractedImages : [],
        });
      }
    }
  } catch (err) {
    console.warn('Legacy .ppt CFB parser warning:', err);
  }

  if (slides.length > 0) {
    return slides;
  }

  // Last-resort ASCII scan if binary structure is heavily corrupted
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      current += String.fromCharCode(b);
    } else {
      const trimmed = current.trim();
      if (trimmed.length >= 6 && /[a-zA-Z]{3,}/.test(trimmed)) {
        lines.push(trimmed);
      }
      current = '';
    }
  }
  const unique = Array.from(new Set(lines)).slice(0, 120);
  return [
    {
      slideNumber: 1,
      title: 'PowerPoint Presentation (.PPT)',
      bulletPoints:
        unique.length > 0
          ? unique
          : ['No readable text runs found in this legacy .ppt binary file.'],
      images: extractedImages,
    },
  ];
}

export function parsePresentationText(text: string): SlideItem[] {
  if (!text) return [];
  const slides: SlideItem[] = [];
  const lines = text.split('\n');
  let currentSlide: SlideItem | null = null;
  let slideCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().startsWith('slide') || trimmed.startsWith('#')) {
      slideCount++;
      if (currentSlide) slides.push(currentSlide);
      currentSlide = {
        slideNumber: slideCount,
        title: trimmed.replace(/^slide\s*\d+:?\s*/i, '').replace(/^#+\s*/, ''),
        bulletPoints: [],
        images: [],
      };
    } else {
      if (!currentSlide) {
        slideCount++;
        currentSlide = {
          slideNumber: slideCount,
          title: `Slide ${slideCount}`,
          bulletPoints: [],
          images: [],
        };
      }
      currentSlide.bulletPoints.push(trimmed.replace(/^[-*•]\s*/, ''));
    }
  }

  if (currentSlide) slides.push(currentSlide);
  return slides;
}
