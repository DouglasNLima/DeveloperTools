import { formatBytes } from './base64.js';

export const POWER_AUTOMATE_EMAIL_TEMPLATES = [
  {
    id: 'notification',
    label: 'Notification',
    accent: '#2563eb',
    border: '#bfdbfe',
    surface: '#eff6ff',
    heading: '#1e3a8a',
    text: '#111827'
  },
  {
    id: 'approval-update',
    label: 'Approval update',
    accent: '#7c3aed',
    border: '#ddd6fe',
    surface: '#f5f3ff',
    heading: '#4c1d95',
    text: '#111827'
  },
  {
    id: 'alert',
    label: 'Alert',
    accent: '#dc2626',
    border: '#fecaca',
    surface: '#fef2f2',
    heading: '#7f1d1d',
    text: '#111827'
  },
  {
    id: 'digest',
    label: 'Digest',
    accent: '#0f766e',
    border: '#99f6e4',
    surface: '#f0fdfa',
    heading: '#134e4a',
    text: '#111827'
  }
];

export const POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES = [
  { value: 'fragment', label: 'Power Automate body fragment' },
  { value: 'document', label: 'Full HTML document' }
];

const DEFAULT_TEMPLATE_ID = 'notification';
const DEFAULT_OUTPUT_SCOPE = 'fragment';
const FONT_STACK = 'Arial, Helvetica, sans-serif';
const PREVIEW_TOKEN_STYLE = [
  'background-color:#fff7ed',
  'border:1px solid #fdba74',
  'border-radius:3px',
  'color:#9a3412',
  'font-family:Consolas, Monaco, monospace',
  'padding:1px 3px'
].join(';');

export function buildPowerAutomateEmailTemplate(options = {}) {
  const input = String(options.input ?? '');

  if (!input.trim()) {
    throw new Error('Enter email text before generating HTML.');
  }

  const template = normaliseTemplate(options.templateId);
  const outputScope = normaliseOutputScope(options.outputScope);
  const useFirstLineAsHeading = options.useFirstLineAsHeading !== false;
  const content = parseEmailText(input, { useFirstLineAsHeading });
  const tokenAnalysis = analysePowerAutomateTokens(content.tokenSource);
  const warnings = [...content.warnings, ...tokenAnalysis.warnings];
  const fragment = renderEmailFragment({
    template,
    heading: content.heading,
    blocks: content.blocks,
    highlightTokens: false
  });
  const previewFragment = renderEmailFragment({
    template,
    heading: content.heading,
    blocks: content.blocks,
    highlightTokens: true
  });
  const html = outputScope === 'document'
    ? wrapEmailDocument(fragment, content.heading || 'Power Automate email')
    : fragment;
  const previewHtml = wrapEmailDocument(previewFragment, 'Email preview');
  const outputBytes = new TextEncoder().encode(html).length;

  return {
    html,
    previewHtml,
    template,
    heading: content.heading,
    paragraphCount: content.blocks.filter(block => block.type === 'paragraph').length,
    listCount: content.blocks.filter(block => block.type === 'list').length,
    tokenCount: tokenAnalysis.tokens.length,
    outputSizeLabel: formatBytes(outputBytes),
    warnings: [...new Set(warnings)],
    outputScope,
    outputScopeLabel: POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES.find(scope => scope.value === outputScope).label
  };
}

function parseEmailText(input, { useFirstLineAsHeading }) {
  const lines = String(input ?? '').replace(/\r\n?/g, '\n').split('\n');
  const warnings = [];
  let heading = '';
  let bodyLines = [...lines];

  if (useFirstLineAsHeading) {
    const headingIndex = bodyLines.findIndex(line => line.trim());

    if (headingIndex >= 0) {
      heading = bodyLines[headingIndex].trim();
      bodyLines = bodyLines.slice(headingIndex + 1);
    }
  }

  const blocks = parseBodyBlocks(bodyLines);

  if (heading && blocks.length === 0) {
    warnings.push('Only a heading was found; add body text before sending.');
  }

  const tokenSource = [
    heading,
    ...blocks.flatMap(block => (
      block.type === 'paragraph'
        ? [block.text]
        : block.items.map(item => item.text)
    ))
  ].filter(Boolean).join('\n');

  return {
    heading,
    blocks,
    tokenSource,
    warnings
  };
}

function parseBodyBlocks(lines) {
  const blocks = [];
  let currentList = null;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      currentList = null;
      return;
    }

    const listItem = parseListLine(trimmed);

    if (listItem) {
      if (!currentList || currentList.ordered !== listItem.ordered) {
        currentList = {
          type: 'list',
          ordered: listItem.ordered,
          items: []
        };
        blocks.push(currentList);
      }

      currentList.items.push({ text: listItem.text });
      return;
    }

    currentList = null;
    blocks.push({
      type: 'paragraph',
      text: trimmed
    });
  });

  return blocks;
}

function parseListLine(line) {
  const unordered = line.match(/^(?:[-*]|\u2022)\s+(.+)$/);

  if (unordered) {
    return {
      ordered: false,
      text: unordered[1].trim()
    };
  }

  const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);

  if (ordered) {
    return {
      ordered: true,
      text: ordered[2].trim()
    };
  }

  return null;
}

function renderEmailFragment({ template, heading, blocks, highlightTokens }) {
  const contentRows = [];

  if (heading) {
    contentRows.push(renderHeadingRow(heading, template, highlightTokens));
  }

  blocks.forEach(block => {
    if (block.type === 'paragraph') {
      contentRows.push(renderParagraphRow(block.text, template, highlightTokens));
      return;
    }

    contentRows.push(renderListRow(block, template, highlightTokens));
  });

  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${outerTableStyle(template)}">`,
    '  <tr>',
    `    <td align="center" style="padding:24px 12px;">`,
    `      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="${innerTableStyle(template)}">`,
    '        <tr>',
    `          <td style="background-color:${template.accent};font-size:0;line-height:6px;height:6px;">&nbsp;</td>`,
    '        </tr>',
    ...contentRows,
    '      </table>',
    '    </td>',
    '  </tr>',
    '</table>'
  ].join('\n');
}

function renderHeadingRow(heading, template, highlightTokens) {
  return [
    '        <tr>',
    `          <td style="padding:24px 28px 10px 28px;background-color:${template.surface};font-family:${FONT_STACK};">`,
    `            <h1 style="margin:0;color:${template.heading};font-family:${FONT_STACK};font-size:24px;line-height:1.25;font-weight:bold;">${renderInlineText(heading, highlightTokens)}</h1>`,
    '          </td>',
    '        </tr>'
  ].join('\n');
}

function renderParagraphRow(text, template, highlightTokens) {
  return [
    '        <tr>',
    `          <td style="padding:12px 28px 0 28px;background-color:#ffffff;font-family:${FONT_STACK};">`,
    `            <p style="margin:0 0 12px 0;color:${template.text};font-family:${FONT_STACK};font-size:15px;line-height:1.55;">${renderInlineText(text, highlightTokens)}</p>`,
    '          </td>',
    '        </tr>'
  ].join('\n');
}

function renderListRow(block, template, highlightTokens) {
  const rows = block.items.map((item, index) => [
    '                <tr>',
    `                  <td valign="top" width="28" style="width:28px;padding:0 8px 8px 0;color:${template.accent};font-family:${FONT_STACK};font-size:15px;line-height:1.5;font-weight:bold;">${block.ordered ? `${index + 1}.` : '&bull;'}</td>`,
    `                  <td valign="top" style="padding:0 0 8px 0;color:${template.text};font-family:${FONT_STACK};font-size:15px;line-height:1.5;">${renderInlineText(item.text, highlightTokens)}</td>`,
    '                </tr>'
  ].join('\n'));

  return [
    '        <tr>',
    `          <td style="padding:4px 28px 8px 28px;background-color:#ffffff;font-family:${FONT_STACK};">`,
    `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`,
    ...rows,
    '            </table>',
    '          </td>',
    '        </tr>'
  ].join('\n');
}

function wrapEmailDocument(fragment, title) {
  return [
    '<!doctype html>',
    '<html lang="en-GB">',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${escapeHtml(title)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background-color:#f3f4f6;">`,
    fragment,
    '</body>',
    '</html>'
  ].join('\n');
}

function renderInlineText(value, highlightTokens) {
  const text = String(value ?? '');

  if (!highlightTokens) {
    return escapeHtml(text);
  }

  const tokens = analysePowerAutomateTokens(text).tokens;

  if (tokens.length === 0) {
    return escapeHtml(text);
  }

  let output = '';
  let cursor = 0;

  tokens.forEach(token => {
    output += escapeHtml(text.slice(cursor, token.start));
    output += `<span data-power-automate-token="true" style="${PREVIEW_TOKEN_STYLE}">${escapeHtml(token.value)}</span>`;
    cursor = token.end;
  });

  output += escapeHtml(text.slice(cursor));
  return output;
}

function analysePowerAutomateTokens(value) {
  const text = String(value ?? '');
  const tokens = [];
  const warnings = [];
  let foundIncompleteToken = false;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '@') {
      continue;
    }

    if (text[index + 1] === '{') {
      const end = findMatchingCharacter(text, index + 1, '{', '}');

      if (end < 0) {
        foundIncompleteToken = true;
        continue;
      }

      tokens.push({
        start: index,
        end: end + 1,
        value: text.slice(index, end + 1)
      });
      index = end;
      continue;
    }

    if (!/[A-Za-z_]/.test(text[index + 1] || '')) {
      continue;
    }

    let nameEnd = index + 2;

    while (/[A-Za-z0-9_]/.test(text[nameEnd] || '')) {
      nameEnd += 1;
    }

    let openIndex = nameEnd;

    while (/\s/.test(text[openIndex] || '')) {
      openIndex += 1;
    }

    if (text[openIndex] !== '(') {
      continue;
    }

    const end = findMatchingCharacter(text, openIndex, '(', ')');

    if (end < 0) {
      foundIncompleteToken = true;
      continue;
    }

    tokens.push({
      start: index,
      end: end + 1,
      value: text.slice(index, end + 1)
    });
    index = end;
  }

  if (foundIncompleteToken) {
    warnings.push('Some Power Automate tokens look incomplete and were left unchanged.');
  }

  return {
    tokens,
    warnings
  };
}

function findMatchingCharacter(text, openIndex, openCharacter, closeCharacter) {
  let depth = 0;
  let quote = null;

  for (let index = openIndex; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quote) {
      if (character === quote) {
        if (quote === '\'' && next === '\'') {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '\'' || character === '"') {
      quote = character;
      continue;
    }

    if (character === openCharacter) {
      depth += 1;
      continue;
    }

    if (character === closeCharacter) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function outerTableStyle(template) {
  return [
    'border-collapse:collapse',
    'mso-table-lspace:0pt',
    'mso-table-rspace:0pt',
    'width:100%',
    `background-color:${template.surface}`,
    'margin:0',
    'padding:0'
  ].join(';');
}

function innerTableStyle(template) {
  return [
    'border-collapse:collapse',
    'mso-table-lspace:0pt',
    'mso-table-rspace:0pt',
    'width:100%',
    'max-width:640px',
    'background-color:#ffffff',
    `border:1px solid ${template.border}`
  ].join(';');
}

function normaliseTemplate(templateId) {
  return POWER_AUTOMATE_EMAIL_TEMPLATES.find(template => template.id === templateId)
    || POWER_AUTOMATE_EMAIL_TEMPLATES.find(template => template.id === DEFAULT_TEMPLATE_ID);
}

function normaliseOutputScope(outputScope) {
  return POWER_AUTOMATE_EMAIL_OUTPUT_SCOPES.some(scope => scope.value === outputScope)
    ? outputScope
    : DEFAULT_OUTPUT_SCOPE;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
