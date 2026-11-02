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
  // Convert plain structured text to clean styled HTML paragraphs if raw DOCX buffer is not provided
  return text
    .split('\n\n')
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      if (/^\d+\.\s/.test(trimmed) || trimmed.startsWith('#')) {
        return `<h2 class="font-headline-md text-headline-md text-on-surface mt-4 mb-2">${trimmed.replace(/^#+\s*/, '')}</h2>`;
      }
      return `<p class="font-body-md text-body-md text-on-surface mb-3 leading-relaxed">${trimmed}</p>`;
    })
    .join('');
}
