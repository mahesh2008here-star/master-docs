export function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  return markdown
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<br/>';

      if (trimmed.startsWith('# ')) {
        return `<h1 class="font-headline-lg text-headline-lg text-on-surface mt-6 mb-3 tracking-tight">${trimmed.slice(2)}</h1>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h2 class="font-headline-md text-headline-md text-on-surface mt-5 mb-2">${trimmed.slice(3)}</h2>`;
      }
      if (trimmed.startsWith('### ')) {
        return `<h3 class="font-headline-sm text-headline-sm text-on-surface mt-4 mb-2">${trimmed.slice(4)}</h3>`;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li class="font-body-md text-body-md text-on-surface ml-4 mb-1 list-disc">${trimmed.slice(2)}</li>`;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return `<li class="font-body-md text-body-md text-on-surface ml-4 mb-1 list-decimal">${trimmed.replace(/^\d+\.\s/, '')}</li>`;
      }
      if (trimmed.startsWith('> ')) {
        return `<blockquote class="p-3 my-3 bg-surface-container rounded-lg border-l-4 border-primary italic text-on-surface-variant font-body-sm">${trimmed.slice(2)}</blockquote>`;
      }

      // Bold and inline code replacements
      const formatted = trimmed
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-surface-container-high rounded text-primary font-mono text-xs">$1</code>');

      return `<p class="font-body-md text-body-md text-on-surface mb-3 leading-relaxed">${formatted}</p>`;
    })
    .join('');
}
