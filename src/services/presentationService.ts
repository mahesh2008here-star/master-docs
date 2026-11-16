import JSZip from 'jszip';

export interface SlideItem {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
  images: string[];
  notes?: string;
}

const IMAGE_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

function normalizeZipRelTarget(baseDir: string, target: string): string {
  if (!target) return '';
  if (target.startsWith('/')) {
    return target.slice(1);
  }
  const parts = (baseDir ? `${baseDir}/${target}` : target).split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

function extractParagraphsFromSlideXml(xmlDoc: Document): string[] {
  const paragraphs: string[] = [];
  // Match <a:p> elements across namespace prefixes
  const allElements = Array.from(xmlDoc.getElementsByTagName('*'));
  for (const el of allElements) {
    if (el.localName === 'p') {
      const textParts: string[] = [];
      const descendants = Array.from(el.getElementsByTagName('*'));
      for (const child of descendants) {
        if (child.localName === 't' && child.textContent) {
          textParts.push(child.textContent);
        }
      }
      const combined = textParts.join('').replace(/\s+/g, ' ').trim();
      if (combined.length > 0) {
        paragraphs.push(combined);
      }
    }
  }
  return paragraphs;
}

async function resolveImagesFromRels(
  zip: JSZip,
  relsPath: string,
  baseDir: string,
  mediaMapLower: Record<string, string>,
  parser: DOMParser
): Promise<{ images: string[]; layoutRelsPaths: Array<{ relsPath: string; baseDir: string }>; notesPath?: string }> {
  const images: string[] = [];
  const layoutRelsPaths: Array<{ relsPath: string; baseDir: string }> = [];
  let notesPath: string | undefined;

  const relsFile = zip.files[relsPath];
  if (!relsFile) return { images, layoutRelsPaths };

  const relsXml = await relsFile.async('text');
  const relsDoc = parser.parseFromString(relsXml, 'text/xml');
  const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));

  for (const rel of relationships) {
    const target = rel.getAttribute('Target') || '';
    const type = rel.getAttribute('Type') || '';
    const targetMode = rel.getAttribute('TargetMode') || '';
    if (targetMode.toLowerCase() === 'external') continue;

    const resolved = normalizeZipRelTarget(baseDir, target);
    const resolvedLower = resolved.toLowerCase();

    if (type.includes('/image') && mediaMapLower[resolvedLower]) {
      images.push(mediaMapLower[resolvedLower]);
    } else if (type.includes('/notesSlide')) {
      notesPath = resolved;
    } else if (type.includes('/slideLayout')) {
      const layoutParts = resolved.split('/');
      const layoutFile = layoutParts.pop() || '';
      const layoutDir = layoutParts.join('/');
      layoutRelsPaths.push({
        relsPath: `${layoutDir}/_rels/${layoutFile}.rels`,
        baseDir: layoutDir,
      });
    }
  }

  return { images, layoutRelsPaths, notesPath };
}

export async function parsePptxArrayBuffer(buffer: Uint8Array | ArrayBuffer): Promise<SlideItem[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides: SlideItem[] = [];

    // Load supported raster & SVG media from ppt/media/
    const mediaMapLower: Record<string, string> = {};
    for (const path of Object.keys(zip.files)) {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      if (/^ppt\/media\//i.test(path) && IMAGE_MIME_MAP[ext]) {
        try {
          const b64 = await zip.files[path].async('base64');
          mediaMapLower[path.toLowerCase()] = `data:${IMAGE_MIME_MAP[ext]};base64,${b64}`;
        } catch (err) {
          console.warn(`Skipped media ${path}:`, err);
        }
      }
    }

    // Check if OpenDocument Presentation (.odp)
    if (zip.files['content.xml'] && !zip.files['ppt/presentation.xml']) {
      return await parseOdpFromZip(zip);
    }

    const slideFiles = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(path)
    );

    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml$/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml$/i)?.[1] || '0', 10);
      return numA - numB;
    });

    const parser = new DOMParser();

    for (let i = 0; i < slideFiles.length; i++) {
      const filePath = slideFiles[i];
      const slideNum = i + 1;
      const slideFileName = filePath.split('/').pop() || '';
      const xmlString = await zip.files[filePath].async('text');
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      const paragraphs = extractParagraphsFromSlideXml(xmlDoc);
      const relsPath = `ppt/slides/_rels/${slideFileName}.rels`;

      const relInfo = await resolveImagesFromRels(
        zip,
        relsPath,
        'ppt/slides',
        mediaMapLower,
        parser
      );

      const seenImages = new Set<string>(relInfo.images);
      // Include slideLayout images if slide itself embeds none (common for background graphics/diagrams)
      if (seenImages.size === 0) {
        for (const layoutRef of relInfo.layoutRelsPaths) {
          const layoutRes = await resolveImagesFromRels(
            zip,
            layoutRef.relsPath,
            layoutRef.baseDir,
            mediaMapLower,
            parser
          );
          for (const img of layoutRes.images) {
            seenImages.add(img);
          }
        }
      }

      // Extract speaker notes if present
      let notes: string | undefined;
      if (relInfo.notesPath && zip.files[relInfo.notesPath]) {
        const notesXml = await zip.files[relInfo.notesPath].async('text');
        const notesDoc = parser.parseFromString(notesXml, 'text/xml');
        const noteParas = extractParagraphsFromSlideXml(notesDoc).filter(
          (t) => !/^\d+$/.test(t)
        );
        if (noteParas.length > 0) {
          notes = noteParas.join('\n');
        }
      }

      const title = paragraphs[0] || `Slide ${slideNum}`;
      const bulletPoints = paragraphs.length > 1 ? paragraphs.slice(1) : [];

      slides.push({
        slideNumber: slideNum,
        title,
        bulletPoints:
          bulletPoints.length > 0 || seenImages.size > 0
            ? bulletPoints
            : ['(Visual slide — no text body)'],
        images: Array.from(seenImages),
        notes,
      });
    }

    if (slides.length > 0) return slides;
  } catch (error) {
    console.warn('PPTX zip parsing fallback engaged:', error);
  }

  // Handle legacy OLE2 binary .ppt files cleanly instead of throwing
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return extractLegacyPptSlides(bytes);
  }

  return [
    {
      slideNumber: 1,
      title: 'Presentation Loaded',
      bulletPoints: ['No slide XML entries were found in this file.'],
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
        if (href && mediaMap[href]) images.push(mediaMap[href]);
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

function extractLegacyPptSlides(bytes: Uint8Array): SlideItem[] {
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
      title: 'Legacy Binary .PPT Text Preview',
      bulletPoints:
        unique.length > 0
          ? unique
          : ['Legacy PowerPoint 97-2003 binary presentation contains no plain ASCII runs. Save as .PPTX for full slide & image layout.'],
      images: [],
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
