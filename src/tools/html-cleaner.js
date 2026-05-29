import { formatBytes } from './base64.js';

export const HTML_OUTPUT_FORMATS = [
  { value: 'plain-text', label: 'Plain text' },
  { value: 'markdown', label: 'Markdown' }
];

const DEFAULT_OUTPUT_FORMAT = 'plain-text';
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'template']);
const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul'
]);
const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  cent: 'c',
  copy: '(c)',
  euro: 'EUR',
  gt: '>',
  hellip: '...',
  laquo: '<<',
  ldquo: '"',
  lsaquo: '<',
  lsquo: "'",
  lt: '<',
  mdash: '-',
  middot: '*',
  nbsp: ' ',
  ndash: '-',
  pound: 'GBP',
  quot: '"',
  raquo: '>>',
  rdquo: '"',
  reg: '(R)',
  rsaquo: '>',
  rsquo: "'",
  shy: '',
  trade: '(TM)',
  yen: 'JPY'
};

export function processHtmlContent(options = {}) {
  const input = String(options.input ?? '');

  if (!input.trim()) {
    throw new Error('Enter HTML input.');
  }

  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const parsed = parseHtml(input);
  const output = outputFormat === 'markdown'
    ? renderMarkdown(parsed.root)
    : renderPlainText(parsed.root);
  const warnings = [...parsed.warnings];

  if (!output.trim()) {
    warnings.push('Output is empty after removing non-visible HTML content.');
  }

  const inputBytes = countUtf8Bytes(input);
  const outputBytes = countUtf8Bytes(output);

  return {
    output,
    outputFormat,
    outputType: HTML_OUTPUT_FORMATS.find(format => format.value === outputFormat).label,
    elementCount: parsed.elementCount,
    referenceCount: countReferences(parsed.root),
    warnings: [...new Set(warnings)],
    inputBytes,
    outputBytes,
    inputSizeLabel: formatBytes(inputBytes),
    outputSizeLabel: formatBytes(outputBytes)
  };
}

export function parseHtml(input) {
  const source = String(input ?? '');
  const root = createRootNode();
  const stack = [root];
  const warnings = [];
  let elementCount = 0;
  let index = 0;

  while (index < source.length) {
    const nextOpen = source.indexOf('<', index);

    if (nextOpen === -1) {
      appendText(stack.at(-1), source.slice(index));
      break;
    }

    if (nextOpen > index) {
      appendText(stack.at(-1), source.slice(index, nextOpen));
    }

    if (source.startsWith('<!--', nextOpen)) {
      const commentEnd = source.indexOf('-->', nextOpen + 4);

      if (commentEnd === -1) {
        warnings.push('An HTML comment was not closed.');
        break;
      }

      index = commentEnd + 3;
      continue;
    }

    if (source.startsWith('<![CDATA[', nextOpen)) {
      const cdataEnd = source.indexOf(']]>', nextOpen + 9);
      const cdataText = cdataEnd === -1
        ? source.slice(nextOpen + 9)
        : source.slice(nextOpen + 9, cdataEnd);

      appendText(stack.at(-1), cdataText);
      index = cdataEnd === -1 ? source.length : cdataEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(source, nextOpen + 1);

    if (tagEnd === -1) {
      appendText(stack.at(-1), source.slice(nextOpen));
      warnings.push('A tag was not closed and was treated as text.');
      break;
    }

    const rawTag = source.slice(nextOpen + 1, tagEnd);
    index = tagEnd + 1;

    if (!rawTag.trim()) {
      appendText(stack.at(-1), '<>');
      continue;
    }

    if (/^!doctype\b/i.test(rawTag) || /^![^[]/.test(rawTag) || /^\?/.test(rawTag)) {
      continue;
    }

    if (/^\//.test(rawTag.trimStart())) {
      closeElement(rawTag, stack, warnings);
      continue;
    }

    const tag = parseStartTag(rawTag);

    if (!tag) {
      appendText(stack.at(-1), `<${rawTag}>`);
      continue;
    }

    elementCount += 1;

    if (RAW_TEXT_TAGS.has(tag.name)) {
      const closeIndex = findRawTextClose(source, index, tag.name);

      if (closeIndex === -1) {
        warnings.push(`The <${tag.name}> element was not closed; its content was removed.`);
        index = source.length;
      } else {
        index = closeIndex;
      }

      continue;
    }

    const element = createElementNode(tag.name, tag.attributes);
    stack.at(-1).children.push(element);

    if (!tag.selfClosing && !VOID_TAGS.has(tag.name)) {
      stack.push(element);
    }
  }

  if (stack.length > 1) {
    const openTags = stack.slice(1).map(node => `<${node.tagName}>`);
    warnings.push(`Unclosed tags were closed automatically: ${openTags.join(', ')}.`);
  }

  return {
    root,
    elementCount,
    warnings: [...new Set(warnings)]
  };
}

function renderPlainText(root) {
  return cleanPlainOutput(renderPlainChildren(root.children, 0));
}

function renderPlainNode(node, listDepth = 0) {
  if (node.type === 'text') {
    return decodeEntities(node.value).replace(/\s+/g, ' ');
  }

  const tag = node.tagName;

  if (tag === 'br') {
    return '\n';
  }

  if (tag === 'hr') {
    return '\n---\n';
  }

  if (tag === 'img') {
    return normaliseInlineText(node.attributes.alt || '');
  }

  if (tag === 'a') {
    const text = normaliseInlineText(renderPlainChildren(node.children, listDepth));
    return text || node.attributes.href || '';
  }

  if (tag === 'ul' || tag === 'ol') {
    return renderPlainList(node, tag === 'ol', listDepth);
  }

  if (tag === 'table') {
    return wrapPlainBlock(renderPlainTable(node));
  }

  if (tag === 'tr') {
    return renderPlainTableRow(node);
  }

  if (tag === 'pre') {
    return wrapPlainBlock(getDecodedText(node).trim());
  }

  if (/^h[1-6]$/.test(tag) || BLOCK_TAGS.has(tag)) {
    return wrapPlainBlock(renderPlainChildren(node.children, listDepth));
  }

  return renderPlainChildren(node.children, listDepth);
}

function renderPlainChildren(children, listDepth = 0) {
  return children.map(child => renderPlainNode(child, listDepth)).join('');
}

function renderPlainList(node, ordered, depth) {
  const items = node.children.filter(child => child.type === 'element' && child.tagName === 'li');
  const indent = '  '.repeat(depth);

  return wrapPlainBlock(items.map((item, itemIndex) => {
    const marker = ordered ? `${itemIndex + 1}.` : '-';
    const content = cleanPlainOutput(renderPlainChildren(item.children, depth + 1));
    const lines = content ? content.split('\n') : [''];

    return lines.map((line, lineIndex) => (
      lineIndex === 0
        ? `${indent}${marker} ${line}`.trimEnd()
        : `${indent}  ${line}`.trimEnd()
    )).join('\n');
  }).join('\n'));
}

function renderPlainTable(node) {
  const rows = collectTableRows(node)
    .map(row => renderPlainTableRow(row))
    .filter(Boolean);

  return rows.join('\n');
}

function renderPlainTableRow(row) {
  return row.children
    .filter(child => child.type === 'element' && (child.tagName === 'td' || child.tagName === 'th'))
    .map(cell => normaliseInlineText(renderPlainChildren(cell.children)))
    .join('\t');
}

function renderMarkdown(root) {
  return cleanMarkdownOutput(renderMarkdownChildren(root.children, 0));
}

function renderMarkdownNode(node, listDepth = 0) {
  if (node.type === 'text') {
    return escapeMarkdownText(decodeEntities(node.value).replace(/\s+/g, ' '));
  }

  const tag = node.tagName;

  if (tag === 'br') {
    return '  \n';
  }

  if (tag === 'hr') {
    return '\n\n---\n\n';
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `\n\n${'#'.repeat(level)} ${renderMarkdownInline(node.children).trim()}\n\n`;
  }

  if (tag === 'p') {
    return wrapMarkdownBlock(renderMarkdownInline(node.children));
  }

  if (tag === 'strong' || tag === 'b') {
    return wrapInlineMarkup(renderMarkdownInline(node.children), '**');
  }

  if (tag === 'em' || tag === 'i') {
    return wrapInlineMarkup(renderMarkdownInline(node.children), '_');
  }

  if (tag === 's' || tag === 'strike' || tag === 'del') {
    return wrapInlineMarkup(renderMarkdownInline(node.children), '~~');
  }

  if (tag === 'code') {
    return wrapInlineCode(getDecodedText(node));
  }

  if (tag === 'pre') {
    return renderMarkdownCodeBlock(node);
  }

  if (tag === 'a') {
    const text = renderMarkdownInline(node.children).trim() || escapeMarkdownText(node.attributes.href || '');
    const href = node.attributes.href || '';

    return href ? `[${text}](${escapeMarkdownUrl(href)})` : text;
  }

  if (tag === 'img') {
    const alt = escapeMarkdownText(node.attributes.alt || '');
    const src = node.attributes.src || '';

    return src ? `![${alt}](${escapeMarkdownUrl(src)})` : alt;
  }

  if (tag === 'ul' || tag === 'ol') {
    return renderMarkdownList(node, tag === 'ol', listDepth);
  }

  if (tag === 'blockquote') {
    return renderMarkdownBlockquote(node, listDepth);
  }

  if (tag === 'table') {
    return renderMarkdownTable(node);
  }

  if (tag === 'tr' || tag === 'td' || tag === 'th') {
    return renderMarkdownInline(node.children);
  }

  if (BLOCK_TAGS.has(tag)) {
    return wrapMarkdownBlock(renderMarkdownChildren(node.children, listDepth));
  }

  return renderMarkdownChildren(node.children, listDepth);
}

function renderMarkdownChildren(children, listDepth = 0) {
  return children.map(child => renderMarkdownNode(child, listDepth)).join('');
}

function renderMarkdownInline(children) {
  return cleanInlineMarkdown(renderMarkdownChildren(children));
}

function renderMarkdownList(node, ordered, depth) {
  const items = node.children.filter(child => child.type === 'element' && child.tagName === 'li');
  const indent = '  '.repeat(depth);
  const lines = [];

  items.forEach((item, itemIndex) => {
    const marker = ordered ? `${itemIndex + 1}.` : '-';
    const nestedLists = item.children.filter(child => child.type === 'element' && (child.tagName === 'ul' || child.tagName === 'ol'));
    const ownChildren = item.children.filter(child => !nestedLists.includes(child));
    const ownContent = cleanMarkdownOutput(renderMarkdownChildren(ownChildren, depth + 1))
      .replace(/\n{2,}/g, '\n')
      .trim();
    const contentLines = ownContent ? ownContent.split('\n') : [''];

    lines.push(`${indent}${marker} ${contentLines[0]}`.trimEnd());
    contentLines.slice(1).forEach(line => {
      lines.push(`${indent}  ${line}`.trimEnd());
    });

    nestedLists.forEach(list => {
      const nested = renderMarkdownList(list, list.tagName === 'ol', depth + 1).replace(/^\n+|\n+$/g, '');

      if (nested) {
        lines.push(nested);
      }
    });
  });

  return `\n${lines.join('\n')}\n\n`;
}

function renderMarkdownBlockquote(node, listDepth) {
  const content = cleanMarkdownOutput(renderMarkdownChildren(node.children, listDepth));

  if (!content) {
    return '';
  }

  const quoted = content
    .split('\n')
    .map(line => (line ? `> ${line}` : '>'))
    .join('\n');

  return `\n\n${quoted}\n\n`;
}

function renderMarkdownCodeBlock(node) {
  const code = getDecodedText(node).replace(/\n+$/, '');
  const language = detectCodeLanguage(node);
  const fence = code.includes('```') ? '~~~' : '```';

  return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
}

function renderMarkdownTable(node) {
  const rows = collectTableRows(node)
    .map(row => ({
      hasHeaderCell: row.children.some(child => child.type === 'element' && child.tagName === 'th'),
      cells: row.children
        .filter(child => child.type === 'element' && (child.tagName === 'td' || child.tagName === 'th'))
        .map(cell => cleanMarkdownTableCell(renderMarkdownInline(cell.children)))
    }))
    .filter(row => row.cells.length > 0);

  if (rows.length === 0) {
    return '';
  }

  const headerIndex = rows.findIndex(row => row.hasHeaderCell);
  const header = rows[headerIndex === -1 ? 0 : headerIndex];
  const bodyRows = rows.filter((_, index) => index !== (headerIndex === -1 ? 0 : headerIndex));
  const columnCount = Math.max(...rows.map(row => row.cells.length));
  const normalisedHeader = padCells(header.cells, columnCount);
  const lines = [
    `| ${normalisedHeader.join(' | ')} |`,
    `| ${new Array(columnCount).fill('---').join(' | ')} |`,
    ...bodyRows.map(row => `| ${padCells(row.cells, columnCount).join(' | ')} |`)
  ];

  return `\n\n${lines.join('\n')}\n\n`;
}

function cleanPlainOutput(value) {
  return String(value ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanMarkdownOutput(value) {
  return String(value ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanInlineMarkdown(value) {
  return String(value ?? '')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function wrapPlainBlock(value) {
  const content = cleanPlainOutput(value);
  return content ? `\n\n${content}\n\n` : '';
}

function wrapMarkdownBlock(value) {
  const content = cleanMarkdownOutput(value);
  return content ? `\n\n${content}\n\n` : '';
}

function normaliseInlineText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function wrapInlineMarkup(value, marker) {
  const content = cleanInlineMarkdown(value);
  return content ? `${marker}${content}${marker}` : '';
}

function wrapInlineCode(value) {
  const content = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!content) {
    return '';
  }

  if (content.includes('`')) {
    return `\`\` ${content} \`\``;
  }

  return `\`${content}\``;
}

function cleanMarkdownTableCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim();
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/([*_`[\]])/g, '\\$1');
}

function escapeMarkdownUrl(value) {
  return String(value ?? '').replace(/\)/g, '%29').replace(/\s/g, '%20');
}

function padCells(cells, count) {
  const padded = [...cells];

  while (padded.length < count) {
    padded.push('');
  }

  return padded;
}

function getDecodedText(node) {
  if (node.type === 'text') {
    return decodeEntities(node.value);
  }

  return node.children.map(child => getDecodedText(child)).join('');
}

function collectTableRows(node) {
  const rows = [];

  visitNodes(node, child => {
    if (child.type === 'element' && child.tagName === 'tr') {
      rows.push(child);
    }
  });

  return rows;
}

function countReferences(root) {
  let count = 0;

  visitNodes(root, node => {
    if (node.type !== 'element') {
      return;
    }

    if (node.tagName === 'a' && node.attributes.href) {
      count += 1;
    }

    if (node.tagName === 'img' && node.attributes.src) {
      count += 1;
    }
  });

  return count;
}

function visitNodes(node, visitor) {
  visitor(node);

  if (node.children) {
    node.children.forEach(child => visitNodes(child, visitor));
  }
}

function detectCodeLanguage(node) {
  const codeNode = node.children.find(child => child.type === 'element' && child.tagName === 'code');
  const className = codeNode?.attributes.class || node.attributes.class || '';
  const match = className.match(/(?:^|\s)language-([A-Za-z0-9_-]+)/);

  return match ? match[1] : '';
}

function closeElement(rawTag, stack, warnings) {
  const tagName = rawTag.replace(/^\s*\//, '').trim().split(/\s+/)[0]?.toLowerCase();

  if (!tagName) {
    return;
  }

  const matchIndex = findOpenElementIndex(stack, tagName);

  if (matchIndex === -1) {
    warnings.push(`Closing tag </${tagName}> did not match an open element.`);
    return;
  }

  if (matchIndex < stack.length - 1) {
    const closed = stack.slice(matchIndex + 1).map(node => `<${node.tagName}>`);
    warnings.push(`Tags were closed automatically before </${tagName}>: ${closed.join(', ')}.`);
  }

  stack.length = matchIndex;
}

function findOpenElementIndex(stack, tagName) {
  for (let index = stack.length - 1; index > 0; index -= 1) {
    if (stack[index].tagName === tagName) {
      return index;
    }
  }

  return -1;
}

function parseStartTag(rawTag) {
  const content = rawTag.trim();
  const nameMatch = content.match(/^([A-Za-z][A-Za-z0-9:-]*)/);

  if (!nameMatch) {
    return null;
  }

  const name = nameMatch[1].toLowerCase();
  const rest = content.slice(nameMatch[0].length);

  return {
    name,
    attributes: parseAttributes(rest),
    selfClosing: /\/\s*$/.test(rest)
  };
}

function parseAttributes(value) {
  const attributes = {};
  const source = String(value ?? '').replace(/\/\s*$/, '');
  const pattern = /([^\s=/"'<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(source))) {
    const name = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    attributes[name] = decodeEntities(rawValue);
  }

  return attributes;
}

function findTagEnd(source, startIndex) {
  let quote = null;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '>') {
      return index;
    }
  }

  return -1;
}

function findRawTextClose(source, startIndex, tagName) {
  const closePattern = new RegExp(`</${escapeRegExp(tagName)}\\s*>`, 'i');
  const match = closePattern.exec(source.slice(startIndex));

  return match ? startIndex + match.index + match[0].length : -1;
}

function appendText(parent, value) {
  if (!value) {
    return;
  }

  const previous = parent.children.at(-1);

  if (previous?.type === 'text') {
    previous.value += value;
    return;
  }

  parent.children.push({
    type: 'text',
    value
  });
}

function createRootNode() {
  return {
    type: 'root',
    children: []
  };
}

function createElementNode(tagName, attributes) {
  return {
    type: 'element',
    tagName,
    attributes,
    children: []
  };
}

function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return decodeCodePoint(entity.slice(2), 16, match);
    }

    if (entity.startsWith('#')) {
      return decodeCodePoint(entity.slice(1), 10, match);
    }

    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });
}

function decodeCodePoint(value, radix, fallback) {
  const codePoint = Number.parseInt(value, radix);

  if (!Number.isFinite(codePoint)) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function normaliseOutputFormat(value) {
  return HTML_OUTPUT_FORMATS.some(format => format.value === value) ? value : DEFAULT_OUTPUT_FORMAT;
}

function countUtf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
