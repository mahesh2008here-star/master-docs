import JSZip from 'jszip';

export interface SlideItem {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
}

export async function parsePptxArrayBuffer(buffer: ArrayBuffer): Promise<SlideItem[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides: SlideItem[] = [];

    // Find all slide XML files in ppt/slides/
    const slideFiles = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(path)
    );

    // Sort slide files by slide number (e.g. slide1.xml, slide2.xml, slide10.xml)
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    const parser = new DOMParser();

    for (let i = 0; i < slideFiles.length; i++) {
      const filePath = slideFiles[i];
      const xmlString = await zip.files[filePath].async('text');
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Extract all text nodes (<a:t>) inside the slide
      const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t'));
      const textStrings = textNodes
        .map((node) => node.textContent?.trim() || '')
        .filter((text) => text.length > 0);

      if (textStrings.length > 0) {
        const title = textStrings[0];
        const bulletPoints = textStrings.slice(1);
        slides.push({
          slideNumber: i + 1,
          title,
          bulletPoints,
        });
      } else {
        slides.push({
          slideNumber: i + 1,
          title: `Presentation Slide ${i + 1}`,
          bulletPoints: ['[Empty or Graphic Slide]'],
        });
      }
    }

    return slides.length > 0 ? slides : fallbackParsePresentationText('');
  } catch (error) {
    console.error('Failed to parse PPTX zip structure:', error);
    return fallbackParsePresentationText('');
  }
}

export function parsePresentationText(text: string): SlideItem[] {
  if (!text) return [];

  // Prevent showing binary ZIP headers (e.g. PK... [Content_Types].xml)
  if (text.startsWith('PK') || text.includes('[Content_Types].xml')) {
    return [
      {
        slideNumber: 1,
        title: 'PowerPoint Presentation',
        bulletPoints: [
          'Presentation file imported successfully.',
          'Please re-import using the updated SAF document handler to view extracted slide content.',
        ],
      },
    ];
  }

  return fallbackParsePresentationText(text);
}

function fallbackParsePresentationText(text: string): SlideItem[] {
  if (!text) {
    return [
      {
        slideNumber: 1,
        title: 'PowerPoint Slide Overview',
        bulletPoints: [
          'Slide content processed.',
          'Use page navigation controls below to navigate presentation slides.',
        ],
      },
    ];
  }

  const slides: SlideItem[] = [];
  const lines = text.split('\n');

  let currentSlide: SlideItem | null = null;
  let slideCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().startsWith('slide') || trimmed.startsWith('#')) {
      slideCount++;
      if (currentSlide) {
        slides.push(currentSlide);
      }
      currentSlide = {
        slideNumber: slideCount,
        title: trimmed.replace(/^slide\s*\d+:?\s*/i, '').replace(/^#+\s*/, ''),
        bulletPoints: [],
      };
    } else {
      if (!currentSlide) {
        slideCount++;
        currentSlide = {
          slideNumber: slideCount,
          title: 'Presentation Slide ' + slideCount,
          bulletPoints: [],
        };
      }
      currentSlide.bulletPoints.push(trimmed.replace(/^[-*•]\s*/, ''));
    }
  }

  if (currentSlide) {
    slides.push(currentSlide);
  }

  return slides;
}
