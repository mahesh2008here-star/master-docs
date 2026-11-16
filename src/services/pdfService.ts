import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export type PDFDocumentProxy = pdfjsLib.PDFDocumentProxy;
export type PDFPageProxy = pdfjsLib.PDFPageProxy;
export type RenderTask = pdfjsLib.RenderTask;

let workerConfigured = false;

export function ensurePdfWorkerConfigured(): void {
  if (workerConfigured || typeof window === 'undefined') return;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
    workerConfigured = true;
  } catch (err) {
    console.warn('Failed to assign local pdfjs workerSrc:', err);
  }
}

function getLocalPdfAssetUrl(folder: string): string {
  if (typeof window === 'undefined') return `/pdfjs/${folder}/`;
  return new URL(`pdfjs/${folder}/`, window.location.href).href;
}

export class PdfPasswordRequiredError extends Error {
  public readonly incorrectPassword: boolean;
  constructor(incorrectPassword = false) {
    super(incorrectPassword ? 'Incorrect PDF password' : 'Password required to open PDF');
    this.name = 'PdfPasswordRequiredError';
    this.incorrectPassword = incorrectPassword;
  }
}

export async function openPdfDocument(
  bytes: Uint8Array,
  password?: string
): Promise<PDFDocumentProxy> {
  ensurePdfWorkerConfigured();

  // Always copy bytes before passing to pdfjs so worker transfer never detaches caller buffers
  const safeCopy = new Uint8Array(bytes.byteLength);
  safeCopy.set(bytes);

  const loadingTask = pdfjsLib.getDocument({
    data: safeCopy,
    password: password || undefined,
    cMapUrl: getLocalPdfAssetUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: getLocalPdfAssetUrl('standard_fonts'),
    wasmUrl: getLocalPdfAssetUrl('wasm'),
    iccUrl: getLocalPdfAssetUrl('iccs'),
    useSystemFonts: true,
    isOffscreenCanvasSupported: typeof OffscreenCanvas !== 'undefined',
  });

  try {
    return await loadingTask.promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      throw new PdfPasswordRequiredError(err?.code === 2);
    }
    throw err;
  }
}

export async function extractPdfPageText(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function destroyPdfDocument(pdfDoc: PDFDocumentProxy | null): Promise<void> {
  if (!pdfDoc) return;
  try {
    await pdfDoc.cleanup();
  } catch {
    // ignore cleanup error
  }
  try {
    await pdfDoc.loadingTask?.destroy();
  } catch {
    // ignore destroy error
  }
}
