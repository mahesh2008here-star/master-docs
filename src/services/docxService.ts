import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export interface DocxRenderResult {
  html: string;
  plainText: string;
  messages: string[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTagsToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function convertDocxXmlFallback(bytes: Uint8Array): Promise<DocxRenderResult> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.files['word/document.xml'];
  if (!docFile) {
    throw new Error('Invalid DOCX archive: missing word/document.xml');
  }

  const mediaMap: Record<string, string> = {};
  for (const path of Object.keys(zip.files)) {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (/^word\/media\//i.test(path) && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      const b64 = await zip.files[path].async('base64');
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      mediaMap[path.toLowerCase()] = `data:${mime};base64,${b64}`;
    }
  }

  const parser = new DOMParser();
  const xmlText = await docFile.async('text');
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const htmlBlocks: string[] = [];
  const plainParts: string[] = [];

  for (const p of Array.from(xmlDoc.getElementsByTagName('*')).filter((n) => n.localName === 'p')) {
    const txt = Array.from(p.getElementsByTagName('*'))
      .filter((ch) => ch.localName === 't')
      .map((ch) => ch.textContent || '')
      .join('')
      .trim();
    if (txt) {
      htmlBlocks.push(`<p class="font-sans text-[1em] mb-3 leading-relaxed">${escapeHtml(txt)}</p>`);
      plainParts.push(txt);
    }
  }

  for (const imgSrc of Object.values(mediaMap)) {
    htmlBlocks.push(`<div class="my-3"><img src="${imgSrc}" alt="Document graphic" class="max-w-full h-auto rounded-lg border border-black/15" /></div>`);
  }

  return {
    html: htmlBlocks.join('') || '<p class="text-[1em] opacity-75">Document contains no readable text.</p>',
    plainText: plainParts.join('\n'),
    messages: [],
  };
}

export async function convertDocxToHtml(bytes: Uint8Array | ArrayBuffer): Promise<DocxRenderResult> {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;

  try {
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const styledHtml = result.value
      .replace(/<p>/gi, '<p class="font-sans text-[1em] mb-3 leading-relaxed">')
      .replace(/<img\s/gi, '<img class="max-w-full h-auto rounded-lg my-3 border border-black/15" ')
      .replace(/<table/gi, '<div class="overflow-x-auto my-3"><table class="w-full border-collapse text-[0.9em] border border-black/20"')
      .replace(/<\/table>/gi, '</table></div>')
      .replace(/<td/gi, '<td class="border border-black/15 p-2 align-top"')
      .replace(/<th/gi, '<th class="border border-black/20 p-2 bg-black/5 font-bold text-left"');

    if (styledHtml.trim()) {
      return {
        html: styledHtml,
        plainText: stripTagsToText(result.value),
        messages: result.messages.map((m) => m.message),
      };
    }
  } catch (err) {
    console.warn('Mammoth fallback to raw OOXML DOCX parser:', err);
  }

  return await convertDocxXmlFallback(uint8);
}

export function convertRtfToHtml(rtfText: string): DocxRenderResult {
  let text = rtfText
    .replace(/\{\\\*\\[^}]*\}/g, '')
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict|object)[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '')
    .replace(/\\par\b/g, '\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\\tab\b/g, '  ')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => {
      const n = parseInt(code, 10);
      return String.fromCharCode(n < 0 ? n + 65536 : n);
    })
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) {
    text = 'RTF document opened, but no plain text paragraphs were found.';
  }

  const html = text
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="font-sans text-[1em] mb-3 leading-relaxed">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return {
    html,
    plainText: text,
    messages: [],
  };
}

export async function convertOdtToHtml(bytes: Uint8Array): Promise<DocxRenderResult> {
  const zip = await JSZip.loadAsync(bytes);
  const contentFile = zip.files['content.xml'];
  if (!contentFile) {
    throw new Error('Invalid ODT archive: missing content.xml');
  }

  const mediaMap: Record<string, string> = {};
  for (const path of Object.keys(zip.files)) {
    if (/^Pictures\/.+\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(path)) {
      const b64 = await zip.files[path].async('base64');
      const ext = path.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      mediaMap[path] = `data:${mime};base64,${b64}`;
      mediaMap[path.toLowerCase()] = mediaMap[path];
    }
  }

  const xmlText = await contentFile.async('text');
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const blocks: string[] = [];
  const plainParts: string[] = [];

  const elements = Array.from(doc.getElementsByTagName('*'));
  for (const el of elements) {
    const tag = el.localName;
    if (tag === 'h') {
      const txt = el.textContent?.trim();
      if (txt) {
        blocks.push(`<h2 class="font-heading font-bold text-[1.25em] mt-4 mb-2 border-b border-black/10 pb-1">${escapeHtml(txt)}</h2>`);
        plainParts.push(txt);
      }
    } else if (tag === 'p') {
      const txt = el.textContent?.trim();
      if (txt) {
        blocks.push(`<p class="font-sans text-[1em] mb-3 leading-relaxed">${escapeHtml(txt)}</p>`);
        plainParts.push(txt);
      }
    } else if (tag === 'image') {
      const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
      const imgSrc = mediaMap[href] || mediaMap[href.toLowerCase()];
      if (imgSrc) {
        blocks.push(`<div class="my-3"><img src="${imgSrc}" alt="Document graphic" class="max-w-full h-auto rounded-lg border border-black/15" /></div>`);
      }
    }
  }

  return {
    html: blocks.join('') || '<p class="text-[1em] opacity-75">Empty ODT document.</p>',
    plainText: plainParts.join('\n'),
    messages: [],
  };
}

export async function convertEpubToHtml(bytes: Uint8Array): Promise<DocxRenderResult> {
  const zip = await JSZip.loadAsync(bytes);
  const parser = new DOMParser();

  // Build image lookup map inside EPUB archive
  const mediaMapLower: Record<string, string> = {};
  for (const path of Object.keys(zip.files)) {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      const b64 = await zip.files[path].async('base64');
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      mediaMapLower[path.toLowerCase()] = `data:${mime};base64,${b64}`;
    }
  }

  // Determine exact reading order from META-INF/container.xml -> .opf <spine>
  let spinePaths: string[] = [];
  const containerFile = zip.files['META-INF/container.xml'];
  if (containerFile) {
    try {
      const containerXml = parser.parseFromString(await containerFile.async('text'), 'text/xml');
      const rootfile = containerXml.getElementsByTagName('rootfile')[0];
      const opfPath = rootfile?.getAttribute('full-path') || '';
      if (opfPath && zip.files[opfPath]) {
        const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
        const opfDoc = parser.parseFromString(await zip.files[opfPath].async('text'), 'text/xml');
        const idToHref = new Map<string, string>();
        for (const item of Array.from(opfDoc.getElementsByTagName('item'))) {
          const id = item.getAttribute('id') || '';
          const href = item.getAttribute('href') || '';
          if (id && href) {
            idToHref.set(id, opfDir ? `${opfDir}/${href}` : href);
          }
        }
        for (const itemref of Array.from(opfDoc.getElementsByTagName('itemref'))) {
          const idref = itemref.getAttribute('idref') || '';
          const resolved = idToHref.get(idref);
          if (resolved && zip.files[resolved]) {
            spinePaths.push(resolved);
          }
        }
      }
    } catch {
      spinePaths = [];
    }
  }

  const xhtmlFiles =
    spinePaths.length > 0
      ? spinePaths
      : Object.keys(zip.files)
          .filter((p) => /\.(xhtml|html|htm)$/i.test(p) && !p.startsWith('__MACOSX'))
          .sort();

  const sections: string[] = [];
  const plainParts: string[] = [];

  for (const filePath of xhtmlFiles.slice(0, 60)) {
    const raw = await zip.files[filePath].async('text');
    const parsed = parser.parseFromString(raw, 'text/html');
    const chapterDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
    const bodyText = parsed.body?.textContent?.trim() || '';

    const nodesHtml = Array.from(parsed.body?.querySelectorAll('h1,h2,h3,p,li,img') || [])
      .map((node) => {
        if (node.tagName === 'IMG') {
          const src = node.getAttribute('src') || '';
          const parts = (chapterDir ? `${chapterDir}/${src}` : src).split('/');
          const resolved: string[] = [];
          for (const part of parts) {
            if (!part || part === '.') continue;
            if (part === '..') resolved.pop();
            else resolved.push(part);
          }
          const imgData = mediaMapLower[resolved.join('/').toLowerCase()];
          return imgData
            ? `<div class="my-3"><img src="${imgData}" alt="Chapter illustration" class="max-w-full h-auto rounded-lg border border-black/15" /></div>`
            : '';
        }
        const t = node.textContent?.trim() || '';
        if (!t) return '';
        if (node.tagName === 'H1' || node.tagName === 'H2') {
          return `<h2 class="font-heading font-bold text-[1.25em] mt-5 mb-2 border-b border-black/10 pb-1">${escapeHtml(t)}</h2>`;
        }
        if (node.tagName === 'H3') {
          return `<h3 class="font-heading font-bold text-[1.1em] mt-4 mb-1">${escapeHtml(t)}</h3>`;
        }
        return `<p class="font-sans text-[1em] mb-3 leading-relaxed">${escapeHtml(t)}</p>`;
      })
      .filter(Boolean)
      .join('');

    if (nodesHtml || bodyText) {
      sections.push(nodesHtml || `<p class="font-sans text-[1em] mb-3 leading-relaxed">${escapeHtml(bodyText)}</p>`);
      if (bodyText) plainParts.push(bodyText);
    }
  }

  return {
    html: sections.join('') || '<p class="text-[1em] opacity-75">No readable chapters found in EPUB.</p>',
    plainText: plainParts.join('\n\n'),
    messages: [],
  };
}

/**
 * Extracts readable ASCII & UTF-16LE text runs from legacy OLE2 binary .doc files via XLSX.CFB.
 */
export function extractLegacyBinaryDocHtml(bytes: Uint8Array): DocxRenderResult {
  let targetBytes = bytes;
  try {
    const cfb = XLSX.CFB.read(bytes, { type: 'array' });
    const wordDocEntry = XLSX.CFB.find(cfb, '/WordDocument');
    if (wordDocEntry && wordDocEntry.content) {
      targetBytes =
        wordDocEntry.content instanceof Uint8Array
          ? wordDocEntry.content
          : new Uint8Array(wordDocEntry.content);
    }
  } catch {
    // scan full container bytes
  }

  const chunks: string[] = [];

  // 1. Printable ASCII runs
  let current = '';
  for (let i = 0; i < targetBytes.length; i++) {
    const b = targetBytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      current += String.fromCharCode(b);
    } else {
      if (current.trim().length >= 8 && /[a-zA-Z]{3,}/.test(current)) {
        chunks.push(current.trim());
      }
      current = '';
    }
  }
  if (current.trim().length >= 8 && /[a-zA-Z]{3,}/.test(current)) {
    chunks.push(current.trim());
  }

  // 2. Printable UTF-16LE runs (used by Word 97-2003 for Unicode paragraphs)
  let u16 = '';
  for (let i = 0; i + 1 < targetBytes.length; i += 2) {
    const code = targetBytes[i] | (targetBytes[i + 1] << 8);
    if ((code >= 32 && code <= 126) || (code >= 0x00a0 && code <= 0x024f) || code === 13) {
      u16 += code === 13 ? '\n' : String.fromCharCode(code);
    } else {
      for (const line of u16.split('\n')) {
        const t = line.trim();
        if (t.length >= 8 && /[a-zA-Z]{3,}/.test(t)) {
          chunks.push(t);
        }
      }
      u16 = '';
    }
  }

  const filtered = chunks.filter(
    (line) =>
      !/^(Root Entry|WordDocument|1Table|0Table|SummaryInformation|DocumentSummaryInformation|Microsoft|Times New Roman|Calibri|Arial|Normal|Default Paragraph Font|bjbj)/i.test(
        line
      )
  );

  const unique = Array.from(new Set(filtered)).slice(0, 600);
  const banner = `<div class="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-700/30 text-xs font-sans">
    <strong>Legacy Binary .DOC Preview:</strong> Extracted text content from Word 97-2003 document.
  </div>`;

  const body =
    unique.length > 0
      ? unique.map((p) => `<p class="font-sans text-[1em] mb-2.5 leading-relaxed">${escapeHtml(p)}</p>`).join('')
      : '<p class="text-[1em] opacity-75">This legacy binary .doc file contains no readable plain text streams.</p>';

  return {
    html: banner + body,
    plainText: unique.join('\n'),
    messages: [],
  };
}

export async function parseWordDocument(
  bytes: Uint8Array,
  extension: string
): Promise<DocxRenderResult> {
  const ext = extension.toLowerCase();
  if (ext === 'rtf') {
    return convertRtfToHtml(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
  }
  if (ext === 'odt') {
    return await convertOdtToHtml(bytes);
  }
  if (ext === 'epub') {
    return await convertEpubToHtml(bytes);
  }
  if (ext === 'doc') {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 32)).trimStart();
    if (head.startsWith('{\\rtf')) {
      return convertRtfToHtml(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
    }
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return await convertDocxToHtml(bytes);
    }
    if (head.toLowerCase().startsWith('<html') || head.toLowerCase().startsWith('<!doctype')) {
      const htmlText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const txt = doc.body?.innerText || doc.body?.textContent || '';
      return {
        html: txt
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => `<p class="font-sans text-[1em] mb-3 leading-relaxed">${escapeHtml(l)}</p>`)
          .join(''),
        plainText: txt,
        messages: [],
      };
    }
    return extractLegacyBinaryDocHtml(bytes);
  }

  return await convertDocxToHtml(bytes);
}

export function parseDocxRawText(text: string): string {
  if (!text) return '';
  return text
    .split('\n\n')
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      if (/^\d+\.\s/.test(trimmed) || trimmed.startsWith('#')) {
        return `<h2 class="font-heading font-bold text-[1.25em] text-[#1d1c11] dark:text-[#f6f1de] mt-4 mb-2 border-b border-black/10 dark:border-white/10 pb-1">${escapeHtml(trimmed.replace(/^#+\s*/, ''))}</h2>`;
      }
      return `<p class="font-sans text-[1em] text-[#1d1c11] dark:text-[#f6f1de] mb-3 leading-relaxed">${escapeHtml(trimmed)}</p>`;
    })
    .join('');
}
