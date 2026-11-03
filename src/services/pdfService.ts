import * as pdfjsLib from 'pdfjs-dist';

// Configure workerSrc for pdfjs-dist using cdnjs matching installed version
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  } catch (e) {
    console.warn('Failed to assign pdfjs workerSrc:', e);
  }
}

export interface RenderedPdfPage {
  pageNumber: number;
  canvasDataUrl?: string;
  textContent: string;
}

export async function renderPdfPages(
  dataUriOrArrayBuffer: string | ArrayBuffer,
  maxPagesToShow = 50
): Promise<{ totalPages: number; pages: RenderedPdfPage[] }> {
  try {
    let loadingTask;
    if (typeof dataUriOrArrayBuffer === 'string') {
      if (dataUriOrArrayBuffer.startsWith('data:')) {
        const base64Str = dataUriOrArrayBuffer.split(',')[1] || dataUriOrArrayBuffer;
        const binaryStr = atob(base64Str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        loadingTask = pdfjsLib.getDocument({ data: bytes.buffer });
      } else {
        loadingTask = pdfjsLib.getDocument({ url: dataUriOrArrayBuffer });
      }
    } else {
      loadingTask = pdfjsLib.getDocument({ data: dataUriOrArrayBuffer });
    }

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const pagesToRender = Math.min(totalPages, maxPagesToShow);
    const pages: RenderedPdfPage[] = [];

    for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContentObj = await page.getTextContent();
        const textContent = textContentObj.items
          .map((item: any) => item.str || '')
          .join(' ');

        // Render to high resolution canvas
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          const renderContext: any = {
            canvasContext: context,
            viewport: viewport,
          };
          await page.render(renderContext).promise;

          pages.push({
            pageNumber: pageNum,
            canvasDataUrl: canvas.toDataURL('image/png'),
            textContent,
          });
        } else {
          pages.push({
            pageNumber: pageNum,
            textContent,
          });
        }
      } catch (e) {
        console.warn(`Error rendering PDF page ${pageNum}:`, e);
        pages.push({
          pageNumber: pageNum,
          textContent: `[Page ${pageNum} rendered]`,
        });
      }
    }

    return { totalPages, pages };
  } catch (error) {
    console.error('Failed to parse PDF document with pdfjs-dist:', error);
    throw error;
  }
}
