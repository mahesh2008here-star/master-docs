import mammoth from 'mammoth';

export interface DocxRenderResult {
  html: string;
  messages: string[];
}

export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<DocxRenderResult> {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return {
      html: result.value,
      messages: result.messages.map((m) => m.message),
    };
  } catch (error) {
    console.error('Failed to convert DOCX file:', error);
    throw error;
  }
}

export function parseDocxRawText(text: string): string {
  if (!text) return '';
  return text
    .split('\n\n')
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      if (/^\d+\.\s/.test(trimmed) || trimmed.startsWith('#')) {
        return `<h2 class="font-heading font-bold text-lg sm:text-xl text-[#1d1c11] dark:text-[#f6f1de] mt-4 mb-2 border-b border-black/10 dark:border-white/10 pb-1">${trimmed.replace(/^#+\s*/, '')}</h2>`;
      }
      return `<p class="font-sans text-sm text-[#1d1c11] dark:text-[#f6f1de] mb-3 leading-relaxed">${trimmed}</p>`;
    })
    .join('');
}
