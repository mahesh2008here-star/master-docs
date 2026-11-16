import JSZip from 'jszip';
import { DocumentItem, DocumentType, FileExtension } from '../types/document';

const TEXT_LIKE_EXTENSIONS = new Set([
  'txt', 'log', 'json', 'xml', 'html', 'htm', 'yaml', 'yml', 'ini', 'conf', 'cfg',
  'env', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'kt', 'c', 'cpp',
  'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'css', 'scss', 'sql', 'sh', 'bat',
  'ps1', 'tex', 'bib', 'srt', 'vtt', 'properties', 'gradle', 'toml',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'ico', 'avif',
]);

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return 'txt';
  return (parts.pop() || 'txt').toLowerCase().trim();
}

export function getDocumentType(ext: string): DocumentType {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  if (cleanExt === 'pdf') return 'pdf';
  if (['docx', 'doc', 'odt', 'rtf'].includes(cleanExt)) return 'word';
  if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(cleanExt)) return 'excel';
  if (['pptx', 'ppt', 'odp'].includes(cleanExt)) return 'powerpoint';
  if (['md', 'markdown', 'mdx'].includes(cleanExt)) return 'markdown';
  if (IMAGE_EXTENSIONS.has(cleanExt)) return 'image';
  if (TEXT_LIKE_EXTENSIONS.has(cleanExt)) return 'text';
  return 'other';
}

export function isMostlyPrintableText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  const sampleLen = Math.min(bytes.length, 4096);
  // Check UTF-16 BOM
  if (
    sampleLen >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  ) {
    return true;
  }

  let controlBytes = 0;
  for (let i = 0; i < sampleLen; i++) {
    const b = bytes[i];
    if (b === 0) return false; // Null byte indicates binary
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) {
      controlBytes++;
    }
  }
  return controlBytes / sampleLen < 0.05;
}

export function decodeTextBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * Inspects file magic bytes AND filename extension so misnamed files
 * (e.g. RTF saved as .doc, HTML saved as .xls, or unknown extensions containing text)
 * still open reliably inside the unified reader.
 */
export async function detectDocumentFormat(
  bytes: Uint8Array,
  filename: string
): Promise<{ type: DocumentType; extension: string }> {
  const originalExt = getFileExtension(filename);
  const headerAscii = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const trimmedHeader = headerAscii.trimStart();

  // 1. PDF signature (%PDF- allowed within first 1024 bytes per ISO 32000)
  if (bytes.length >= 5 && headerAscii.includes('%PDF-')) {
    return { type: 'pdf', extension: 'pdf' };
  }

  // 2. Image signatures
  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return { type: 'image', extension: 'png' };
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { type: 'image', extension: 'jpg' };
    }
    if (headerAscii.startsWith('GIF87a') || headerAscii.startsWith('GIF89a')) {
      return { type: 'image', extension: 'gif' };
    }
    if (headerAscii.startsWith('RIFF') && headerAscii.slice(8, 12) === 'WEBP') {
      return { type: 'image', extension: 'webp' };
    }
  }

  // 3. RTF signature ({\rtf)
  if (trimmedHeader.startsWith('{\\rtf')) {
    return { type: 'word', extension: 'rtf' };
  }

  // 4. ZIP / OOXML / OpenDocument container (PK\x03\x04)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    try {
      const zip = await JSZip.loadAsync(bytes);
      const names = Object.keys(zip.files);
      if (names.some((n) => n === 'word/document.xml')) {
        return { type: 'word', extension: 'docx' };
      }
      if (names.some((n) => n === 'xl/workbook.xml')) {
        return { type: 'excel', extension: 'xlsx' };
      }
      if (names.some((n) => n === 'ppt/presentation.xml')) {
        return { type: 'powerpoint', extension: 'pptx' };
      }
      if (zip.files['mimetype']) {
        const mime = (await zip.files['mimetype'].async('text')).trim();
        if (mime.includes('opendocument.text')) return { type: 'word', extension: 'odt' };
        if (mime.includes('opendocument.spreadsheet')) return { type: 'excel', extension: 'ods' };
        if (mime.includes('opendocument.presentation')) return { type: 'powerpoint', extension: 'odp' };
        if (mime.includes('epub+zip')) return { type: 'word', extension: 'epub' };
      }
    } catch {
      // Fallback to extension below
    }
  }

  // 5. OLE2 Compound Binary (\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1)
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    const extType = getDocumentType(originalExt);
    if (extType === 'excel' || extType === 'word' || extType === 'powerpoint') {
      return { type: extType, extension: originalExt };
    }
    return { type: 'word', extension: originalExt === 'txt' ? 'doc' : originalExt };
  }

  // 6. SVG text
  if (originalExt === 'svg' || trimmedHeader.toLowerCase().includes('<svg')) {
    return { type: 'image', extension: 'svg' };
  }

  // 7. Fallback by extension, or force-open printable text files even with unknown extensions
  const extType = getDocumentType(originalExt);
  if (extType !== 'other') {
    return { type: extType, extension: originalExt };
  }

  if (isMostlyPrintableText(bytes)) {
    return { type: 'text', extension: originalExt || 'txt' };
  }

  return { type: 'other', extension: originalExt || 'bin' };
}

export function dataUriToUint8Array(dataUri: string): Uint8Array {
  const base64Part = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const cleaned = base64Part.replace(/\s+/g, '');
  const binaryStr = atob(cleaned);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToDataUri(bytes: Uint8Array, mimeType = 'application/octet-stream'): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Always returns a fresh, non-detached Uint8Array copy so worker transfers (PDF.js)
 * never corrupt the stored ArrayBuffer in memory or IndexedDB.
 */
export function getDocumentBytes(doc: DocumentItem): Uint8Array | null {
  if (doc.arrayBuffer && doc.arrayBuffer.byteLength > 0) {
    return new Uint8Array(doc.arrayBuffer.slice(0));
  }
  if (doc.dataUri) {
    try {
      return dataUriToUint8Array(doc.dataUri);
    } catch {
      return null;
    }
  }
  if (doc.content) {
    return new TextEncoder().encode(doc.content);
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDateLabel(isoString: string): string {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface TypeBadgeConfig {
  bgColor: string;
  textColor: string;
  label: string;
  typeKey: DocumentType;
  badgeBg: string;
}

export function getTypeBadgeConfig(type: DocumentType, ext: FileExtension): TypeBadgeConfig {
  const cleanExt = (ext || '').toLowerCase().replace('.', '');
  switch (type) {
    case 'pdf':
      return {
        bgColor: 'bg-[#E65C56]',
        textColor: 'text-white',
        label: 'PDF',
        typeKey: 'pdf',
        badgeBg: 'bg-[#E65C56]',
      };
    case 'word':
      return {
        bgColor: 'bg-[#3478D4]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'DOCX',
        typeKey: 'word',
        badgeBg: 'bg-[#3478D4]',
      };
    case 'excel':
      return {
        bgColor: 'bg-[#249B65]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'XLSX',
        typeKey: 'excel',
        badgeBg: 'bg-[#249B65]',
      };
    case 'powerpoint':
      return {
        bgColor: 'bg-[#D88B32]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'PPTX',
        typeKey: 'powerpoint',
        badgeBg: 'bg-[#D88B32]',
      };
    case 'markdown':
      return {
        bgColor: 'bg-[#8A65C9]',
        textColor: 'text-white',
        label: 'MD',
        typeKey: 'markdown',
        badgeBg: 'bg-[#8A65C9]',
      };
    case 'text':
      return {
        bgColor: 'bg-[#8A65C9]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'TXT',
        typeKey: 'text',
        badgeBg: 'bg-[#8A65C9]',
      };
    case 'image':
      return {
        bgColor: 'bg-[#2E8B8B]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'IMG',
        typeKey: 'image',
        badgeBg: 'bg-[#2E8B8B]',
      };
    default:
      return {
        bgColor: 'bg-[#605C48]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'FILE',
        typeKey: 'other',
        badgeBg: 'bg-[#605C48]',
      };
  }
}

export function generateSamplePdfBytes(): Uint8Array {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 174 >>
stream
BT
/F1 20 Tf
50 720 Td
(MASTER DOCS - Android System Architecture v14) Tj
/F1 12 Tf
0 -30 Td
(Kernel 5.15 LTS - Project Treble Specification) Tj
0 -20 Td
(Hardware Abstraction Layer & IPC Binder Architecture) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000315 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
539
%%EOF`;

  return new TextEncoder().encode(pdfContent);
}
