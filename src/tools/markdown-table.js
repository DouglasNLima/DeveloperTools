import { formatBytes } from './base64.js';
import { serialiseDelimitedRows } from './csv-tsv-helper.js';

export const MARKDOWN_TABLE_OUTPUT_FORMATS = [
  { value: 'markdown', label: 'Markdown table' },
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' }
];

export const MARKDOWN_TABLE_ALIGNMENT_OPTIONS = [
  { value: 'preserve', label: 'Preserve table alignment' },
  { value: 'left', label: 'Left aligned' },
  { value: 'centre', label: 'Centre aligned' },
  { value: 'right', label: 'Right aligned' },
  { value: 'none', label: 'No alignment markers' }
];

const TABLE_SEPARATOR_CELL_PATTERN = /^:?-{3,}:?$/;
const FENCE_OPEN_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;

export function normaliseMarkdownTableInput(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function processMarkdownTables(options = {}) {
  const source = requireMarkdownTableInput(options.input);
  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const alignment = normaliseAlignment(options.alignment);
  const tables = extractMarkdownTables(source);

  if (tables.length === 0) {
    throw new Error('Enter at least one Markdown table before formatting.');
  }

  const warnings = buildWarnings(tables, outputFormat);
  const output = buildOutput(source, tables, { outputFormat, alignment });
  const outputBytes = new TextEncoder().encode(output).length;
  const totalRows = tables.reduce((sum, table) => sum + table.rows.length, 0);
  const totalDataRows = tables.reduce((sum, table) => sum + table.dataRows.length, 0);
  const maxColumns = Math.max(...tables.map(table => table.columnCount));

  return {
    source,
    output,
    outputFormat,
    outputType: MARKDOWN_TABLE_OUTPUT_FORMATS.find(format => format.value === outputFormat).label,
    alignment,
    tables,
    tableCount: tables.length,
    totalRows,
    totalDataRows,
    maxColumns,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    warnings
  };
}

export function extractMarkdownTables(value) {
  const source = normaliseMarkdownTableInput(value);

  if (!source) {
    return [];
  }

  const lines = source.split('\n');
  const tables = [];
  let index = 0;
  let fence = null;

  while (index < lines.length) {
    const fenceState = updateFenceState(lines[index], fence);

    if (fenceState.changed) {
      fence = fenceState.fence;
      index += 1;
      continue;
    }

    if (!fence && isMarkdownTableStart(lines, index)) {
      const table = readMarkdownTable(lines, index, tables.length + 1);
      tables.push(table);
      index = table.endIndex + 1;
      continue;
    }

    index += 1;
  }

  return tables;
}

export function splitMarkdownTableRow(row) {
  const source = trimOuterPipe(String(row ?? '').trim());
  const cells = [];
  let cell = '';
  let escaped = false;
  let inCodeSpan = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '`') {
      inCodeSpan = !inCodeSpan;
      cell += character;
      continue;
    }

    if (character === '|' && !inCodeSpan) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    cell += character;
  }

  if (escaped) {
    cell += '\\';
  }

  cells.push(cell.trim());
  return cells;
}

export function buildMarkdownTableOutputFileName(format) {
  const extension = format === 'csv' ? 'csv' : format === 'tsv' ? 'tsv' : 'md';
  return `markdown-table.${extension}`;
}

function readMarkdownTable(lines, startIndex, tableNumber) {
  const rawRows = [lines[startIndex], lines[startIndex + 1]];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
    if (FENCE_OPEN_PATTERN.test(lines[index])) {
      break;
    }

    rawRows.push(lines[index]);
    index += 1;
  }

  const header = splitMarkdownTableRow(rawRows[0]);
  const alignments = parseMarkdownTableSeparator(rawRows[1]);
  const dataRows = rawRows.slice(2).map(splitMarkdownTableRow);
  const rows = [header, ...dataRows];
  const expectedColumns = Math.max(header.length, alignments.length);
  const columnCount = Math.max(expectedColumns, ...rows.map(row => row.length));
  const normalisedRows = rows.map(row => normaliseRowLength(row, columnCount));
  const normalisedAlignments = normaliseRowLength(alignments, columnCount, 'none');
  const inconsistentRows = rows
    .map((row, rowIndex) => ({
      line: rowIndex === 0 ? startIndex + 1 : startIndex + rowIndex + 2,
      cells: row.length
    }))
    .filter(row => row.cells !== expectedColumns);
  const emptyHeaderColumns = normalisedRows[0]
    .map((cell, columnIndex) => String(cell ?? '').trim() ? null : columnIndex + 1)
    .filter(Boolean);

  return {
    tableNumber,
    lineStart: startIndex + 1,
    lineEnd: index,
    startIndex,
    endIndex: index - 1,
    rawRows,
    rows,
    dataRows,
    normalisedRows,
    alignments: normalisedAlignments,
    expectedColumns,
    columnCount,
    inconsistentRows,
    emptyHeaderColumns
  };
}

function isMarkdownTableStart(lines, index) {
  if (!lines[index] || !lines[index + 1] || !lines[index].includes('|')) {
    return false;
  }

  const header = splitMarkdownTableRow(lines[index]);
  const separator = parseMarkdownTableSeparator(lines[index + 1]);

  return header.length > 1 && separator.length > 1;
}

function parseMarkdownTableSeparator(row) {
  const cells = splitMarkdownTableRow(row);

  if (cells.length < 2 || cells.some(cell => !TABLE_SEPARATOR_CELL_PATTERN.test(cell.replace(/\s+/g, '')))) {
    return [];
  }

  return cells.map(cell => {
    const compact = cell.replace(/\s+/g, '');
    const starts = compact.startsWith(':');
    const ends = compact.endsWith(':');

    if (starts && ends) {
      return 'centre';
    }

    if (ends) {
      return 'right';
    }

    if (starts) {
      return 'left';
    }

    return 'none';
  });
}

function buildOutput(source, tables, options) {
  if (options.outputFormat === 'csv' || options.outputFormat === 'tsv') {
    const delimiter = options.outputFormat === 'tsv' ? '\t' : ',';
    return tables
      .map(table => serialiseDelimitedRows(table.normalisedRows, delimiter))
      .join('\n\n');
  }

  return replaceMarkdownTables(source, tables, options.alignment);
}

function replaceMarkdownTables(source, tables, alignment) {
  const lines = source.split('\n');
  const tableByStart = new Map(tables.map(table => [table.startIndex, table]));
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const table = tableByStart.get(index);

    if (table) {
      output.push(renderMarkdownTable(table, alignment));
      index = table.endIndex + 1;
      continue;
    }

    output.push(lines[index]);
    index += 1;
  }

  return output.join('\n');
}

function renderMarkdownTable(table, alignment) {
  const alignments = table.alignments.map(item => alignment === 'preserve' ? item : alignment);
  const rows = table.normalisedRows.map(row => row.map(escapeMarkdownTableCell));
  const widths = rows[0].map((_cell, columnIndex) => {
    const minimumWidth = minimumSeparatorWidth(alignments[columnIndex]);
    return Math.max(
      minimumWidth,
      ...rows.map(row => displayLength(row[columnIndex] || ''))
    );
  });

  return [
    renderMarkdownTableRow(rows[0], widths, alignments),
    renderMarkdownSeparatorRow(widths, alignments),
    ...rows.slice(1).map(row => renderMarkdownTableRow(row, widths, alignments))
  ].join('\n');
}

function renderMarkdownTableRow(row, widths, alignments) {
  const cells = row.map((cell, index) => padCell(cell, widths[index], alignments[index]));
  return `| ${cells.join(' | ')} |`;
}

function renderMarkdownSeparatorRow(widths, alignments) {
  const cells = widths.map((width, index) => buildSeparatorCell(width, alignments[index]));
  return `| ${cells.join(' | ')} |`;
}

function buildSeparatorCell(width, alignment) {
  if (alignment === 'left') {
    return `:${'-'.repeat(width - 1)}`;
  }

  if (alignment === 'right') {
    return `${'-'.repeat(width - 1)}:`;
  }

  if (alignment === 'centre') {
    return `:${'-'.repeat(width - 2)}:`;
  }

  return '-'.repeat(width);
}

function padCell(value, width, alignment) {
  const text = String(value ?? '');
  const remaining = Math.max(0, width - displayLength(text));

  if (alignment === 'right') {
    return `${' '.repeat(remaining)}${text}`;
  }

  if (alignment === 'centre') {
    const left = Math.floor(remaining / 2);
    const right = remaining - left;
    return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
  }

  return `${text}${' '.repeat(remaining)}`;
}

function minimumSeparatorWidth(alignment) {
  if (alignment === 'centre') {
    return 5;
  }

  if (alignment === 'left' || alignment === 'right') {
    return 4;
  }

  return 3;
}

function buildWarnings(tables, outputFormat) {
  const warnings = [];

  if (tables.length > 1 && outputFormat !== 'markdown') {
    warnings.push('Multiple tables are separated by a blank line in the delimited output.');
  }

  tables.forEach(table => {
    if (table.dataRows.length === 0) {
      warnings.push(`Table ${table.tableNumber} has no data rows.`);
    }

    if (table.inconsistentRows.length > 0) {
      const lines = table.inconsistentRows.map(row => row.line).slice(0, 5).join(', ');
      warnings.push(`Table ${table.tableNumber} has ${table.inconsistentRows.length.toLocaleString('en-GB')} row${table.inconsistentRows.length === 1 ? '' : 's'} with an unexpected column count: line ${lines}.`);
    }

    if (table.emptyHeaderColumns.length > 0) {
      const columns = table.emptyHeaderColumns.slice(0, 5).join(', ');
      warnings.push(`Table ${table.tableNumber} has empty header cells in column ${columns}.`);
    }
  });

  return warnings;
}

function updateFenceState(line, fence) {
  const match = line.match(FENCE_OPEN_PATTERN);

  if (!match) {
    return { changed: false, fence };
  }

  if (!fence) {
    return {
      changed: true,
      fence: {
        marker: match[1][0],
        length: match[1].length
      }
    };
  }

  const closePattern = new RegExp(`^\\s{0,3}${escapeRegExp(fence.marker.repeat(fence.length))}${fence.marker}*\\s*$`);
  return closePattern.test(line)
    ? { changed: true, fence: null }
    : { changed: false, fence };
}

function trimOuterPipe(value) {
  let text = value;

  if (text.startsWith('|')) {
    text = text.slice(1);
  }

  if (text.endsWith('|') && text[text.length - 2] !== '\\') {
    text = text.slice(0, -1);
  }

  return text;
}

function normaliseRowLength(row, count, fill = '') {
  const normalised = [...row];

  while (normalised.length < count) {
    normalised.push(fill);
  }

  return normalised;
}

function escapeMarkdownTableCell(value) {
  return String(value ?? '')
    .trim()
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

function displayLength(value) {
  return Array.from(String(value ?? '')).length;
}

function normaliseOutputFormat(value) {
  return MARKDOWN_TABLE_OUTPUT_FORMATS.some(format => format.value === value) ? value : 'markdown';
}

function normaliseAlignment(value) {
  return MARKDOWN_TABLE_ALIGNMENT_OPTIONS.some(option => option.value === value) ? value : 'preserve';
}

function requireMarkdownTableInput(value) {
  const input = normaliseMarkdownTableInput(value);

  if (!input) {
    throw new Error('Enter Markdown table input before formatting.');
  }

  return input;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
