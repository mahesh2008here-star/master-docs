export interface SlideItem {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
}

export function parsePresentationText(text: string): SlideItem[] {
  if (!text) return [];

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
