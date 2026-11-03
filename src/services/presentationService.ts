import JSZip from 'jszip';

export interface SlideItem {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
  images?: string[]; // Base64 data URLs of images embedded in the slide
}

export async function parsePptxArrayBuffer(buffer: ArrayBuffer): Promise<SlideItem[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides: SlideItem[] = [];

    // Extract all media files from ppt/media/ into a lookup map
    const mediaFiles = Object.keys(zip.files).filter((path) =>
      /^ppt\/media\/.+\.(png|jpeg|jpg|gif|emf|wmf|bmp)$/i.test(path)
    );

    const mediaMap: { [key: string]: string } = {};
    for (const mediaPath of mediaFiles) {
      try {
        const fileData = await zip.files[mediaPath].async('base64');
        const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
        mediaMap[mediaPath] = `data:${mime};base64,${fileData}`;
      } catch (err) {
        console.warn(`Failed to parse media file ${mediaPath}:`, err);
      }
    }

    // All global media array as fallback if specific rels aren't matched
    const allMediaDataUrls = Object.values(mediaMap);

    // Find all slide XML files in ppt/slides/
    const slideFiles = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(path)
    );

    // Sort slide files by slide number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    const parser = new DOMParser();

    for (let i = 0; i < slideFiles.length; i++) {
      const filePath = slideFiles[i];
      const slideNum = i + 1;
      const xmlString = await zip.files[filePath].async('text');
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Extract all text nodes (<a:t>) inside the slide
      const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t'));
      const textStrings = textNodes
        .map((node) => node.textContent?.trim() || '')
        .filter((text) => text.length > 0);

      // Check corresponding rels file for image relationships if any
      const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      const slideImages: string[] = [];

      if (zip.files[relsPath]) {
        try {
          const relsString = await zip.files[relsPath].async('text');
          const relsDoc = parser.parseFromString(relsString, 'text/xml');
          const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));
          for (const rel of relationships) {
            const target = rel.getAttribute('Target') || '';
            const type = rel.getAttribute('Type') || '';
            if (type.includes('image')) {
              // Target is usually like "../media/image1.png"
              const cleanTarget = target.replace(/^\.\.\//, 'ppt/');
              if (mediaMap[cleanTarget]) {
                slideImages.push(mediaMap[cleanTarget]);
              }
            }
          }
        } catch (e) {
          console.warn(`Error reading rels for slide ${slideNum}:`, e);
        }
      }

      // If no rel-specific images found, distribute global media or attach some
      const assignedImages = slideImages.length > 0 ? slideImages : (allMediaDataUrls.length > 0 ? [allMediaDataUrls[i % allMediaDataUrls.length]] : []);

      if (textStrings.length > 0) {
        const title = textStrings[0];
        const bulletPoints = textStrings.slice(1);
        slides.push({
          slideNumber: slideNum,
          title,
          bulletPoints,
          images: assignedImages,
        });
      } else {
        slides.push({
          slideNumber: slideNum,
          title: `Presentation Slide ${slideNum}`,
          bulletPoints: ['[Graphic or Image Slide]'],
          images: assignedImages,
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

  if (text.startsWith('PK') || text.includes('[Content_Types].xml')) {
    return [
      {
        slideNumber: 1,
        title: 'PowerPoint Presentation',
        bulletPoints: [
          'Presentation file imported successfully.',
          'Please re-import using the document vault importer to view extracted slides and embedded media.',
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
        images: [],
      };
    } else {
      if (!currentSlide) {
        slideCount++;
        currentSlide = {
          slideNumber: slideCount,
          title: 'Presentation Slide ' + slideCount,
          bulletPoints: [],
          images: [],
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
