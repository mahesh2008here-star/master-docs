import mammoth from 'mammoth';
import JSZip from 'jszip';

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

export async function convertDocxToHtml(bytes: Uint8Array | ArrayBuffer): Promise<DocxRenderResult> {
  const arrayBuffer =
    bytes instanceof Uint8Array
      ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      : bytes.slice(0);

  const result = await mammoth.convertToHtml({ arrayBuffer });
  const styledHtml = result.value
    .replace(/<img\s/gi, '<img class="max-w-full h-auto rounded-lg my-3 border border-black/15" ')
    .replace(/<table/gi, '<div class="overflow-x-auto my-3"><table class="w-full border-collapse text-xs sm:text-sm border border-black/20"')
    .replace(/<\/table>/gi, '</table></div>')
    .replace(/<td/gi, '<td class="border border-black/15 p-2 align-top"')
    .replace(/<th/gi, '<th class="border border-black/20 p-2 bg-black/5 font-bold text-left"');

  return {
    html: styledHtml || '<p class="text-sm opacity-75">Document contains no readable text.</p>',
    plainText: stripTagsToText(result.value),
    messages: result.messages.map((m) => m.message),
  };
}

export function convertRtfToHtml(rtfText: string): DocxRenderResult {
  // Lightweight, reliable RTF plain-text & paragraph extractor
  let text = rtfText
    .replace(/\{\\\*\\[^}]*\}/g, '') // remove destination groups like {\*\fonttbl...}
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
    .map((p) => `<p class="font-sans text-sm mb-3 leading-relaxed">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
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
        blocks.push(`<h2 class="font-heading font-bold text-lg mt-4 mb-2 border-b border-black/10 pb-1">${escapeHtml(txt)}</h2>`);
        plainParts.push(txt);
      }
    } else if (tag === 'p') {
      const txt = el.textContent?.trim();
      if (txt) {
        blocks.push(`<p class="font-sans text-sm mb-3 leading-relaxed">${escapeHtml(txt)}</p>`);
        plainParts.push(txt);
      }
    } else if (tag === 'image') {
      const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
      if (href && mediaMap[href]) {
        blocks.push(`<div class="my-3"><img src="${mediaMap[href]}" alt="Document graphic" class="max-w-full h-auto rounded-lg border border-black/15" /></div>`);
      }
    }
  }

  return {
    html: blocks.join('') || '<p class="text-sm opacity-75">Empty ODT document.</p>',
    plainText: plainParts.join('\n'),
    messages: [],
  };
}

export async function convertEpubToHtml(bytes: Uint8Array): Promise<DocxRenderResult> {
  const zip = await JSZip.loadAsync(bytes);
  const xhtmlFiles = Object.keys(zip.files)
    .filter((p) => /\.(xhtml|html|htm)$/i.test(p) && !p.startsWith('__MACOSX'))
    .sort();

  const sections: string[] = [];
  const plainParts: string[] = [];

  for (const filePath of xhtmlFiles.slice(0, 40)) {
    const raw = await zip.files[filePath].async('text');
    const parsed = new DOMParser().parseFromString(raw, 'text/html');
    const bodyText = parsed.body?.textContent?.trim();
    if (bodyText) {
      const paragraphs = Array.from(parsed.body.querySelectorAll('h1,h2,h3,p,li'))
        .map((node) => {
          const t = node.textContent?.trim() || '';
          if (!t) return '';
          if (node.tagName === 'H1' || node.tagName === 'H2') {
            return `<h2 class="font-heading font-bold text-lg mt-5 mb-2 border-b border-black/10 pb-1">${escapeHtml(t)}</h2>`;
          }
          if (node.tagName === 'H3') {
            return `<h3 class="font-heading font-bold text-base mt-4 mb-1">${escapeHtml(t)}</h3>`;
          }
          return `<p class="font-sans text-sm mb-3 leading-relaxed">${escapeHtml(t)}</p>`;
        })
        .filter(Boolean)
        .join('');

      sections.push(paragraphs || `<p class="font-sans text-sm mb-3 leading-relaxed">${escapeHtml(bodyText)}</p>`);
      plainParts.push(bodyText);
    }
  }

  return {
    html: sections.join('') || '<p class="text-sm opacity-75">No readable chapters found in EPUB.</p>',
    plainText: plainParts.join('\n\n'),
    messages: [],
  };
}

/**
 * Extracts readable UTF-16LE and ASCII text runs from legacy OLE2 binary .doc files.
 */
export function extractLegacyBinaryDocHtml(bytes: Uint8Array): DocxRenderResult {
  const chunks: string[] = [];

  // Extract printable ASCII runs (>= 6 chars)
  let current = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
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

  // Filter out common OLE2 structural noise
  const filtered = chunks.filter(
    (line) =>
      !/^(Root Entry|WordDocument|1Table|0Table|SummaryInformation|DocumentSummaryInformation|Microsoft|Times New Roman|Calibri|Arial|Normal|Default Paragraph Font)$/i.test(
        line
      )
  );

  const unique = Array.from(new Set(filtered)).slice(0, 500);
  const banner = `<div class="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-700/30 text-xs font-sans">
    <strong>Legacy Binary .DOC Preview:</strong> Showing extracted text content from legacy Word 97-2003 binary format.
  </div>`;

  const body =
    unique.length > 0
      ? unique.map((p) => `<p class="font-sans text-sm mb-2.5 leading-relaxed">${escapeHtml(p)}</p>`).join('')
      : '<p class="text-sm opacity-75">This legacy binary .doc file uses compressed streams with no plain ASCII text runs.</p>';

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
    // Check if actually DOCX/RTF/HTML masquerading as .doc
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
          .map((l) => `<p class="font-sans text-sm mb-3 leading-relaxed">${escapeHtml(l)}</p>`)
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
        return `<h2 class="font-heading font-bold text-lg sm:text-xl text-[#1d1c11] dark:text-[#f6f1de] mt-4 mb-2 border-b border-black/10 dark:border-white/10 pb-1">${escapeHtml(trimmed.replace(/^#+\s*/, ''))}</h2>`;
      }
      return `<p class="font-sans text-sm text-[#1d1c11] dark:text-[#f6f1de] mb-3 leading-relaxed">${escapeHtml(trimmed)}</p>`;
    })
    .join('');
}
