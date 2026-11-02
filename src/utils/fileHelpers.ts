import { DocumentType, FileExtension } from '../types/document';

export function getDocumentType(ext: string): DocumentType {
  const cleanExt = ext.toLowerCase().replace('.', '');
  switch (cleanExt) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
    case 'odt':
      return 'word';
    case 'xlsx':
    case 'xls':
    case 'csv':
    case 'ods':
      return 'excel';
    case 'pptx':
    case 'ppt':
    case 'odp':
      return 'powerpoint';
    case 'txt':
    case 'log':
    case 'rtf':
      return 'text';
    case 'md':
    case 'markdown':
      return 'markdown';
    default:
      return 'other';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDateLabel(isoString: string): string {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
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
  icon: string;
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
        icon: 'picture_as_pdf',
        badgeBg: 'bg-[#E65C56]',
      };
    case 'word':
      return {
        bgColor: 'bg-[#3478D4]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'DOCX',
        icon: 'description',
        badgeBg: 'bg-[#3478D4]',
      };
    case 'excel':
      return {
        bgColor: 'bg-[#249B65]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'XLSX',
        icon: 'table_chart',
        badgeBg: 'bg-[#249B65]',
      };
    case 'powerpoint':
      return {
        bgColor: 'bg-[#D88B32]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'PPTX',
        icon: 'slideshow',
        badgeBg: 'bg-[#D88B32]',
      };
    case 'markdown':
      return {
        bgColor: 'bg-[#8A65C9]',
        textColor: 'text-white',
        label: 'MD',
        icon: 'code_blocks',
        badgeBg: 'bg-[#8A65C9]',
      };
    case 'text':
      return {
        bgColor: 'bg-[#8A65C9]',
        textColor: 'text-white',
        label: 'TXT',
        icon: 'article',
        badgeBg: 'bg-[#8A65C9]',
      };
    default:
      return {
        bgColor: 'bg-[#605C48]',
        textColor: 'text-white',
        label: cleanExt.toUpperCase() || 'FILE',
        icon: 'draft',
        badgeBg: 'bg-[#605C48]',
      };
  }
}

// Generate valid minimal PDF sample ArrayBuffer or Data URI for default vault items
export function generateSamplePdfDataUri(): string {
  // A clean 100% valid 1-page PDF string encoded as data URI
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

  return 'data:application/pdf;base64,' + btoa(pdfContent);
}
