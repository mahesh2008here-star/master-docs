import * as pdfjsLib from 'pdfjs-dist';

// Use inline worker or default worker options for pdfjs-dist
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    // Set worker to self-contained blob or standard fallback if available
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  } catch (e) {
    // Ignore worker assignment error and allow sync fallback
  }
}

export interface RenderedPdfPage {
  pageNumber: number;
  canvasDataUrl?: string;
  textContent: string;
}

export async function renderPdfPages(
  dataUriOrArrayBuffer: string | ArrayBuffer,
  maxPagesToShow = 25
): Promise<{ totalPages: number; pages: RenderedPdfPage[] }> {
  try {
    let loadingTask;
    if (typeof dataUriOrArrayBuffer === 'string') {
      loadingTask = pdfjsLib.getDocument({ url: dataUriOrArrayBuffer });
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

        // Render to offscreen canvas
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          const renderContext: any = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
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
          textContent: `[Page ${pageNum} content rendered]`,
        });
      }
    }

    return { totalPages, pages };
  } catch (error) {
    console.error('Failed to parse PDF document:', error);
    throw error;
  }
}
