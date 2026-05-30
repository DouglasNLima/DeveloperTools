import { formatBytes } from './base64.js';

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const ORDERED_LIST_PATTERN = /^\s{0,3}\d+[.)]\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^\s{0,3}[-*+]\s+(.+)$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const HORIZONTAL_RULE_PATTERN = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;

export function normaliseMarkdownSource(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function extractMarkdownMermaidBlocks(value) {
  return extractFencedBlocks(value)
    .filter(block => ['mermaid', 'mmd'].includes(block.language.toLocaleLowerCase('en-GB')));
}

export function renderMarkdownPreview(options = {}) {
  const source = normaliseMarkdownSource(options.input);

  if (!source) {
    throw new Error('Enter Markdown input before rendering.');
  }

  const analysis = analyseMarkdown(source);

  return {
    ...analysis,
    html: renderMarkdownToHtml(source, analysis),
    warnings: buildMarkdownWarnings(source, analysis)
  };
}

export function analyseMarkdown(value) {
  const source = normaliseMarkdownSource(value);
  const lines = source ? source.split('\n') : [];
  const fencedBlocks = extractFencedBlocks(source);
  const mermaidBlocks = fencedBlocks.filter(block => ['mermaid', 'mmd'].includes(block.language.toLocaleLowerCase('en-GB')));
  const outline = extractOutline(source);
  const referenceText = removeFencedBlocks(source, fencedBlocks);
  const links = extractMarkdownLinks(referenceText);
  const images = extractMarkdownImages(referenceText);
  const tableCount = countMarkdownTables(source);
  const inputBytes = new TextEncoder().encode(source).length;

  return {
    source,
    outline,
    links,
    images,
    codeFences: fencedBlocks,
    mermaidBlocks,
    tableCount,
    lineCount: source ? lines.length : 0,
    wordCount: countWords(removeFencedBlocks(source, fencedBlocks)),
    inputBytes,
    inputSizeLabel: formatBytes(inputBytes)
  };
}

function renderMarkdownToHtml(source, analysis) {
  const lines = source.split('\n');
  const parts = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenced = readFencedBlock(lines, index);

    if (fenced) {
      parts.push(renderFencedBlock(fenced, analysis));
      index = fenced.endLine;
      continue;
    }

    const heading = line.match(HEADING_PATTERN);

    if (heading) {
      const level = heading[1].length;
      const text = stripInlineMarkdown(heading[2]);
      const outlineEntry = analysis.outline.find(entry => entry.line === index + 1 && entry.level === level);
      const id = outlineEntry?.id || slugifyHeading(text, index + 1);
      parts.push(`<h${level} id="${escapeAttribute(id)}">${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (HORIZONTAL_RULE_PATTERN.test(line)) {
      parts.push('<hr>');
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = readTable(lines, index);
      parts.push(renderTable(table.rows));
      index = table.endLine;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const quote = readBlockquote(lines, index);
      parts.push(renderBlockquote(quote.lines));
      index = quote.endLine;
      continue;
    }

    if (ORDERED_LIST_PATTERN.test(line) || UNORDERED_LIST_PATTERN.test(line)) {
      const list = readList(lines, index, ORDERED_LIST_PATTERN.test(line));
      parts.push(renderList(list.items, list.ordered));
      index = list.endLine;
      continue;
    }

    const paragraph = readParagraph(lines, index);
    parts.push(`<p>${renderInlineMarkdown(paragraph.lines.join(' '))}</p>`);
    index = paragraph.endLine;
  }

  return parts.join('\n');
}

function renderFencedBlock(block, analysis) {
  const code = escapeHtml(block.source);
  const language = block.language.toLocaleLowerCase('en-GB');

  if (language === 'mermaid' || language === 'mmd') {
    const mermaidIndex = analysis.mermaidBlocks.findIndex(candidate => (
      candidate.lineStart === block.lineStart && candidate.source === block.source
    ));
    return [
      `<figure class="markdown-mermaid-block" data-mermaid-index="${mermaidIndex}">`,
      '<figcaption>Mermaid diagram</figcaption>',
      `<pre><code>${code}</code></pre>`,
      '</figure>'
    ].join('');
  }

  const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
  return `<pre><code${className}>${code}</code></pre>`;
}

function renderBlockquote(lines) {
  const content = lines
    .map(line => line.replace(/^\s{0,3}>\s?/, ''))
    .join('\n')
    .trim();

  return `<blockquote>${renderMarkdownToHtml(content, analyseMarkdown(content))}</blockquote>`;
}

function renderList(items, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const body = items
    .map(item => `<li>${renderInlineMarkdown(item)}</li>`)
    .join('');

  return `<${tag}>${body}</${tag}>`;
}

function renderTable(rows) {
  const header = splitMarkdownTableRow(rows[0]);
  const bodyRows = rows.slice(2).map(splitMarkdownTableRow);
  const columnCount = Math.max(header.length, ...bodyRows.map(row => row.length), 1);
  const normalisedHeader = padCells(header, columnCount);
  const headerHtml = normalisedHeader.map(cell => `<th>${renderInlineMarkdown(cell)}</th>`).join('');
  const bodyHtml = bodyRows
    .map(row => `<tr>${padCells(row, columnCount).map(cell => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  let text = String(value ?? '').replace(/(`+)([\s\S]*?)\1/g, (_match, _ticks, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(`<code>${escapeHtml(code.trim())}</code>`);
    return token;
  });

  text = escapeHtml(text);
  text = text.replace(/!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (_match, alt, rawUrl) => {
    const safeUrl = sanitiseUrl(rawUrl);
    return `<img src="${escapeAttribute(safeUrl)}" alt="${escapeAttribute(alt)}">`;
  });
  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (_match, label, rawUrl) => {
    const safeUrl = sanitiseUrl(rawUrl);
    return `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

  codeSpans.forEach((html, codeIndex) => {
    text = text.replace(`\u0000CODE${codeIndex}\u0000`, html);
  });

  return text;
}

function readFencedBlock(lines, startIndex) {
  const open = lines[startIndex].match(/^\s{0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)?.*$/);

  if (!open) {
    return null;
  }

  const marker = open[1][0];
  const markerLength = open[1].length;
  const closePattern = new RegExp(`^\\s{0,3}${escapeRegExp(marker.repeat(markerLength))}${marker}*\\s*$`);
  const body = [];
  let index = startIndex + 1;

  while (index < lines.length) {
    if (closePattern.test(lines[index])) {
      return {
        language: open[2] || '',
        source: body.join('\n'),
        lineStart: startIndex + 1,
        lineEnd: index + 1,
        endLine: index + 1
      };
    }

    body.push(lines[index]);
    index += 1;
  }

  return {
    language: open[2] || '',
    source: body.join('\n'),
    lineStart: startIndex + 1,
    lineEnd: lines.length,
    endLine: lines.length
  };
}

function extractFencedBlocks(value) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const block = readFencedBlock(lines, index);

    if (block) {
      blocks.push(block);
      index = block.endLine;
      continue;
    }

    index += 1;
  }

  return blocks;
}

function removeFencedBlocks(source, blocks) {
  if (blocks.length === 0) {
    return source;
  }

  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blockedLines = new Set();

  blocks.forEach(block => {
    for (let line = block.lineStart; line <= block.lineEnd; line += 1) {
      blockedLines.add(line);
    }
  });

  return lines
    .filter((_line, index) => !blockedLines.has(index + 1))
    .join('\n');
}

function extractOutline(source) {
  const ids = new Map();

  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, index) => {
      const match = line.match(HEADING_PATTERN);

      if (!match) {
        return null;
      }

      const text = stripInlineMarkdown(match[2]);
      const baseId = slugifyHeading(text, index + 1);
      const count = ids.get(baseId) || 0;
      ids.set(baseId, count + 1);

      return {
        level: match[1].length,
        text,
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
        line: index + 1
      };
    })
    .filter(Boolean);
}

function extractMarkdownLinks(source) {
  const links = [];
  const pattern = /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    if (source[match.index - 1] === '!') {
      continue;
    }

    links.push({
      label: stripInlineMarkdown(match[1]),
      url: match[2]
    });
  }

  return links;
}

function extractMarkdownImages(source) {
  const images = [];
  const pattern = /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    images.push({
      alt: stripInlineMarkdown(match[1]),
      url: match[2]
    });
  }

  return images;
}

function countMarkdownTables(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  let count = 0;

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (isTableStart(lines, index)) {
      count += 1;
      index += 1;
    }
  }

  return count;
}

function isTableStart(lines, index) {
  return Boolean(lines[index]?.includes('|') && TABLE_SEPARATOR_PATTERN.test(lines[index + 1] || ''));
}

function readTable(lines, startIndex) {
  const rows = [lines[startIndex], lines[startIndex + 1]];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    rows.push(lines[index]);
    index += 1;
  }

  return {
    rows,
    endLine: index
  };
}

function readBlockquote(lines, startIndex) {
  const quoteLines = [];
  let index = startIndex;

  while (index < lines.length && /^\s{0,3}>\s?/.test(lines[index])) {
    quoteLines.push(lines[index]);
    index += 1;
  }

  return {
    lines: quoteLines,
    endLine: index
  };
}

function readList(lines, startIndex, ordered) {
  const pattern = ordered ? ORDERED_LIST_PATTERN : UNORDERED_LIST_PATTERN;
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(pattern);

    if (!match) {
      break;
    }

    items.push(match[1].trim());
    index += 1;
  }

  return {
    ordered,
    items,
    endLine: index
  };
}

function readParagraph(lines, startIndex) {
  const paragraphLines = [];
  let index = startIndex;

  while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
    paragraphLines.push(lines[index].trim());
    index += 1;
  }

  if (paragraphLines.length === 0) {
    paragraphLines.push(lines[index]);
    index += 1;
  }

  return {
    lines: paragraphLines,
    endLine: index
  };
}

function isBlockStart(lines, index) {
  const line = lines[index] || '';
  return Boolean(
    line.match(HEADING_PATTERN)
      || readFencedBlock(lines, index)
      || HORIZONTAL_RULE_PATTERN.test(line)
      || isTableStart(lines, index)
      || /^\s{0,3}>\s?/.test(line)
      || ORDERED_LIST_PATTERN.test(line)
      || UNORDERED_LIST_PATTERN.test(line)
  );
}

function splitMarkdownTableRow(row) {
  return String(row ?? '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function padCells(cells, count) {
  const padded = [...cells];

  while (padded.length < count) {
    padded.push('');
  }

  return padded;
}

function countWords(value) {
  const matches = String(value ?? '').match(/\b[\p{L}\p{N}'-]+\b/gu);
  return matches ? matches.length : 0;
}

function buildMarkdownWarnings(source, analysis) {
  const warnings = [];

  if (/<[A-Za-z][^>]*>/.test(removeFencedBlocks(source, analysis.codeFences))) {
    warnings.push('Raw HTML is escaped in the preview.');
  }

  if (analysis.codeFences.some(block => block.lineEnd === source.split('\n').length && !hasFenceClose(source, block))) {
    warnings.push('A code fence appears to be unclosed.');
  }

  return warnings;
}

function hasFenceClose(source, block) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  return Boolean(lines[block.lineEnd - 1]?.match(/^\s{0,3}(`{3,}|~{3,})\s*$/));
}

function stripInlineMarkdown(value) {
  return String(value ?? '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyHeading(value, fallbackIndex) {
  const slug = String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `heading-${fallbackIndex}`;
}

function sanitiseUrl(value) {
  const rawUrl = String(value ?? '').trim();

  if (!rawUrl) {
    return '#';
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/i.test(rawUrl) && !/^(https?:|mailto:)/i.test(rawUrl)) {
    return '#';
  }

  return rawUrl;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
