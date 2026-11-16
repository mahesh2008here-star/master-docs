export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push(
          `<pre class="p-3 my-3 rounded-xl bg-black/8 dark:bg-white/10 font-mono text-[0.85em] overflow-x-auto leading-relaxed"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      htmlParts.push('<div class="h-2"></div>');
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      htmlParts.push('<hr class="my-4 border-black/15 dark:border-white/15" />');
      continue;
    }

    if (trimmed.startsWith('# ')) {
      htmlParts.push(
        `<h1 class="font-heading font-bold text-[1.45em] mt-5 mb-3 tracking-tight border-b border-black/10 dark:border-white/10 pb-2">${escapeHtml(trimmed.slice(2))}</h1>`
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      htmlParts.push(
        `<h2 class="font-heading font-bold text-[1.25em] mt-4 mb-2">${escapeHtml(trimmed.slice(3))}</h2>`
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      htmlParts.push(
        `<h3 class="font-heading font-bold text-[1.1em] mt-3 mb-1.5">${escapeHtml(trimmed.slice(4))}</h3>`
      );
      continue;
    }

    if (trimmed.startsWith('> ')) {
      htmlParts.push(
        `<blockquote class="p-3 my-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/15 dark:border-white/15 italic text-[0.95em] font-sans">${escapeHtml(trimmed.slice(2))}</blockquote>`
      );
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      htmlParts.push(
        `<li class="font-sans text-[1em] ml-4 mb-1 list-disc">${formatInlineMarkdown(trimmed.slice(2))}</li>`
      );
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      htmlParts.push(
        `<li class="font-sans text-[1em] ml-4 mb-1 list-decimal">${formatInlineMarkdown(trimmed.replace(/^\d+\.\s/, ''))}</li>`
      );
      continue;
    }

    htmlParts.push(
      `<p class="font-sans text-[1em] mb-3 leading-relaxed">${formatInlineMarkdown(trimmed)}</p>`
    );
  }

  if (inCodeBlock && codeLines.length > 0) {
    htmlParts.push(
      `<pre class="p-3 my-3 rounded-xl bg-black/8 dark:bg-white/10 font-mono text-[0.85em] overflow-x-auto leading-relaxed"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
    );
  }

  return htmlParts.join('');
}

function formatInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-[var(--primary-red)] font-mono text-[0.88em] font-bold">$1</code>');
}

export function formatCodeOrStructuredTextToHtml(raw: string, extension: string): string {
  const ext = extension.toLowerCase();
  if (ext === 'json') {
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      return `<pre class="p-3 rounded-xl bg-black/6 dark:bg-white/8 font-mono text-[0.85em] overflow-x-auto leading-relaxed whitespace-pre-wrap break-words"><code>${escapeHtml(pretty)}</code></pre>`;
    } catch {
      // Fall through
    }
  }

  if (ext === 'html' || ext === 'htm') {
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const blocks: string[] = [];
      const nodes = Array.from(doc.body?.querySelectorAll('h1,h2,h3,h4,p,li,pre,blockquote') || []);
      for (const node of nodes) {
        const txt = node.textContent?.trim();
        if (!txt) continue;
        if (/^H[1-2]$/.test(node.tagName)) {
          blocks.push(`<h2 class="font-heading font-bold text-[1.25em] mt-4 mb-2">${escapeHtml(txt)}</h2>`);
        } else if (/^H[3-4]$/.test(node.tagName)) {
          blocks.push(`<h3 class="font-heading font-bold text-[1.1em] mt-3 mb-1">${escapeHtml(txt)}</h3>`);
        } else if (node.tagName === 'PRE') {
          blocks.push(`<pre class="p-3 my-2 rounded-xl bg-black/8 dark:bg-white/10 font-mono text-[0.85em] overflow-x-auto">${escapeHtml(txt)}</pre>`);
        } else {
          blocks.push(`<p class="font-sans text-[1em] mb-2.5 leading-relaxed">${escapeHtml(txt)}</p>`);
        }
      }
      if (blocks.length > 0) return blocks.join('');
    } catch {
      // Fall through
    }
  }

  if (
    ['xml', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'kt', 'c', 'cpp', 'h', 'css', 'sql', 'sh', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log'].includes(
      ext
    )
  ) {
    return `<pre class="p-3 rounded-xl bg-black/6 dark:bg-white/8 font-mono text-[0.85em] overflow-x-auto leading-relaxed whitespace-pre-wrap break-words"><code>${escapeHtml(raw)}</code></pre>`;
  }

  return raw
    .replace(/\r\n/g, '\n')
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p class="font-sans text-[1em] mb-3 leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(block)}</p>`
    )
    .join('') || '<p class="text-[1em] opacity-75">Empty text file.</p>';
}
