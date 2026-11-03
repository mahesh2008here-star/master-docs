export function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  return markdown
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div class="h-2"></div>';

      if (trimmed.startsWith('# ')) {
        return `<h1 class="font-heading font-bold text-xl sm:text-2xl text-[#1d1c11] dark:text-[#f6f1de] mt-6 mb-3 tracking-tight border-b border-black/10 dark:border-white/10 pb-2">${trimmed.slice(2)}</h1>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h2 class="font-heading font-bold text-lg sm:text-xl text-[#1d1c11] dark:text-[#f6f1de] mt-5 mb-2">${trimmed.slice(3)}</h2>`;
      }
      if (trimmed.startsWith('### ')) {
        return `<h3 class="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] mt-4 mb-2">${trimmed.slice(4)}</h3>`;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li class="font-sans text-sm text-[#1d1c11] dark:text-[#f6f1de] ml-4 mb-1 list-disc">${trimmed.slice(2)}</li>`;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return `<li class="font-sans text-sm text-[#1d1c11] dark:text-[#f6f1de] ml-4 mb-1 list-decimal">${trimmed.replace(/^\d+\.\s/, '')}</li>`;
      }
      if (trimmed.startsWith('> ')) {
        return `<blockquote class="p-3 my-3 bg-black/5 dark:bg-white/5 rounded-xl border-l-4 border-[var(--primary-red)] italic text-xs sm:text-sm text-[#58413f] dark:text-[#c8bead] font-sans">${trimmed.slice(2)}</blockquote>`;
      }

      // Bold and inline code replacements
      const formatted = trimmed
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#1d1c11] dark:text-[#f6f1de]">$1</strong>')
        .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-[var(--primary-red)] font-mono text-xs font-bold">$1</code>');

      return `<p class="font-sans text-sm text-[#1d1c11] dark:text-[#f6f1de] mb-3 leading-relaxed">${formatted}</p>`;
    })
    .join('');
}
