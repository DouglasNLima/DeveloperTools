import { formatBytes } from './base64.js';

export const DELIMITER_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'comma', label: 'Comma (,)' },
  { value: 'semicolon', label: 'Semicolon (;)' },
  { value: 'tab', label: 'Tab' }
];

export const OUTPUT_FORMATS = [
  { value: 'json', label: 'JSON array' },
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' }
];

const DELIMITERS = {
  comma: ',',
  semicolon: ';',
  tab: '\t'
};

export function processDelimitedData(options = {}) {
  const input = requireInput(options.input);
  const delimiter = resolveDelimiter(input, options.delimiter);
  const rows = parseDelimitedText(input, delimiter.character);
  const firstRowHeaders = options.firstRowHeaders !== false;
  const outputFormat = normaliseOutputFormat(options.outputFormat);
  const analysis = analyseDelimitedRows(rows, { firstRowHeaders });
  const output = buildDelimitedOutput(rows, {
    outputFormat,
    firstRowHeaders,
    sourceDelimiter: delimiter.character
  });
  const outputBytes = new TextEncoder().encode(output).length;

  return {
    delimiter,
    rows,
    firstRowHeaders,
    outputFormat,
    outputType: OUTPUT_FORMATS.find(format => format.value === outputFormat).label,
    output,
    outputBytes,
    outputSizeLabel: formatBytes(outputBytes),
    analysis,
    warnings: analysis.warnings
  };
}

export function parseDelimitedText(value, delimiter = ',') {
  const input = String(value ?? '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let cellQuoted = false;
  let justClosedQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (inQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else {
        cell += character;
      }

      continue;
    }

    if (character === '"' && cell === '' && !justClosedQuote) {
      inQuotes = true;
      cellQuoted = true;
      continue;
    }

    if (character === delimiter) {
      row.push(cell);
      cell = '';
      cellQuoted = false;
      justClosedQuote = false;
      continue;
    }

    if (character === '\r' || character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      cellQuoted = false;
      justClosedQuote = false;

      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      continue;
    }

    if (justClosedQuote && character.trim() !== '') {
      throw new Error(`Unexpected character after closing quote at character ${index + 1}.`);
    }

    if (!justClosedQuote || character.trim() !== '') {
      cell += character;
    }
  }

  if (inQuotes) {
    throw new Error('Delimited input has an unclosed quoted cell.');
  }

  if (cell.length > 0 || cellQuoted || row.length > 0 || input.endsWith(delimiter)) {
    row.push(cell);
    rows.push(row);
  }

  const cleanedRows = rows.filter((item, index) => {
    if (index !== rows.length - 1) {
      return true;
    }

    return item.length > 1 || item[0] !== '';
  });

  if (cleanedRows.length === 0) {
    throw new Error('Enter delimited data with at least one row.');
  }

  return cleanedRows;
}

export function detectDelimiter(value) {
  const input = requireInput(value);
  const candidates = Object.entries(DELIMITERS).map(([key, character]) => {
    const counts = countDelimiterPerLine(input, character).filter(count => count > 0);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const consistency = counts.length > 0 ? counts.filter(count => count === counts[0]).length / counts.length : 0;

    return {
      key,
      character,
      total,
      consistency,
      score: total + consistency
    };
  });
  const best = candidates.sort((left, right) => right.score - left.score || right.total - left.total)[0];

  return best && best.total > 0
    ? {
        key: best.key,
        character: best.character,
        label: delimiterLabel(best.key),
        detected: true
      }
    : {
        key: 'comma',
        character: ',',
        label: delimiterLabel('comma'),
        detected: false
      };
}

export function analyseDelimitedRows(rows, options = {}) {
  const firstRowHeaders = options.firstRowHeaders !== false;
  const columnCounts = rows.map(row => row.length);
  const expectedColumns = firstRowHeaders ? rows[0].length : mostCommonNumber(columnCounts);
  const dataRows = firstRowHeaders ? rows.slice(1) : rows;
  const emptyCellCount = rows.reduce((total, row) => total + row.filter(cell => cell === '').length, 0);
  const multilineCellCount = rows.reduce(
    (total, row) => total + row.filter(cell => /\r|\n/.test(cell)).length,
    0
  );
  const inconsistentRows = rows
    .map((row, index) => ({ index: index + 1, columns: row.length }))
    .filter(row => row.columns !== expectedColumns);
  const headerAnalysis = firstRowHeaders
    ? analyseHeaders(rows[0] || [])
    : {
        headers: buildGeneratedHeaders(expectedColumns),
        emptyHeaders: [],
        duplicateHeaders: [],
        safeHeaders: buildGeneratedHeaders(expectedColumns)
      };
  const warnings = buildWarnings({
    firstRowHeaders,
    inconsistentRows,
    headerAnalysis,
    multilineCellCount
  });

  return {
    totalRows: rows.length,
    dataRows: dataRows.length,
    columns: expectedColumns,
    emptyCellCount,
    multilineCellCount,
    inconsistentRows,
    headerAnalysis,
    warnings
  };
}

export function buildDelimitedOutput(rows, options = {}) {
  const outputFormat = normaliseOutputFormat(options.outputFormat);

  if (outputFormat === 'json') {
    return JSON.stringify(rowsToObjects(rows, options), null, 2);
  }

  const delimiter = outputFormat === 'tsv' ? '\t' : ',';
  return serialiseDelimitedRows(rows, delimiter);
}

export function rowsToObjects(rows, options = {}) {
  const firstRowHeaders = options.firstRowHeaders !== false;
  const analysis = analyseDelimitedRows(rows, { firstRowHeaders });
  const headers = analysis.headerAnalysis.safeHeaders;
  const dataRows = firstRowHeaders ? rows.slice(1) : rows;

  return dataRows.map(row => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });

    return record;
  });
}

export function serialiseDelimitedRows(rows, delimiter = ',') {
  return rows.map(row => row.map(cell => serialiseDelimitedCell(cell, delimiter)).join(delimiter)).join('\n');
}

export function buildDelimitedOutputFileName(format, sourceName = '') {
  const extension = format === 'json' ? 'json' : format === 'tsv' ? 'tsv' : 'csv';
  const fallback = `delimited-output.${extension}`;
  const base = String(sourceName || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.(csv|tsv|txt|json)$/i, '') || 'delimited-output';

  return `${base}.${extension}`;
}

function resolveDelimiter(input, option) {
  if (option && option !== 'auto') {
    const character = DELIMITERS[option];

    if (!character) {
      throw new Error('Choose a supported delimiter.');
    }

    return {
      key: option,
      character,
      label: delimiterLabel(option),
      detected: false
    };
  }

  return detectDelimiter(input);
}

function normaliseOutputFormat(value) {
  return OUTPUT_FORMATS.some(format => format.value === value) ? value : 'json';
}

function requireInput(value) {
  const input = String(value ?? '');

  if (!input.trim()) {
    throw new Error('Enter CSV or TSV content before processing.');
  }

  return input;
}

function countDelimiterPerLine(value, delimiter) {
  const counts = [];
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextCharacter = value[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (!inQuotes && character === delimiter) {
      count += 1;
      continue;
    }

    if (!inQuotes && (character === '\r' || character === '\n')) {
      counts.push(count);
      count = 0;

      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }
    }
  }

  counts.push(count);
  return counts;
}

function analyseHeaders(headers) {
  const seen = new Map();
  const emptyHeaders = [];
  const duplicateHeaders = [];
  const safeHeaders = headers.map((header, index) => {
    const trimmed = String(header || '').trim();
    const fallback = `column_${index + 1}`;
    const base = trimmed || fallback;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);

    if (!trimmed) {
      emptyHeaders.push(index + 1);
    }

    if (count > 0) {
      duplicateHeaders.push(base);
    }

    return count === 0 ? base : `${base}_${count + 1}`;
  });

  return {
    headers,
    emptyHeaders,
    duplicateHeaders: [...new Set(duplicateHeaders)],
    safeHeaders
  };
}

function buildGeneratedHeaders(count) {
  return Array.from({ length: count }, (_, index) => `column_${index + 1}`);
}

function mostCommonNumber(values) {
  const counts = values.reduce((map, value) => {
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] || 0;
}

function buildWarnings(options) {
  const warnings = [];

  if (options.inconsistentRows.length > 0) {
    const rows = options.inconsistentRows.map(row => row.index).slice(0, 5).join(', ');
    warnings.push(`${options.inconsistentRows.length.toLocaleString('en-GB')} row${options.inconsistentRows.length === 1 ? ' has' : 's have'} an unexpected column count: ${rows}.`);
  }

  if (options.firstRowHeaders && options.headerAnalysis.emptyHeaders.length > 0) {
    warnings.push(`${options.headerAnalysis.emptyHeaders.length.toLocaleString('en-GB')} header${options.headerAnalysis.emptyHeaders.length === 1 ? ' is' : 's are'} empty.`);
  }

  if (options.firstRowHeaders && options.headerAnalysis.duplicateHeaders.length > 0) {
    warnings.push(`Duplicate headers found: ${options.headerAnalysis.duplicateHeaders.join(', ')}.`);
  }

  if (options.multilineCellCount > 0) {
    warnings.push(`${options.multilineCellCount.toLocaleString('en-GB')} cell${options.multilineCellCount === 1 ? ' contains' : 's contain'} a line break.`);
  }

  return warnings;
}

function serialiseDelimitedCell(value, delimiter) {
  const text = String(value ?? '');
  const needsQuotes = text.includes('"') || text.includes(delimiter) || /\r|\n/.test(text) || /^\s|\s$/.test(text);
  const escaped = text.replace(/"/g, '""');

  return needsQuotes ? `"${escaped}"` : escaped;
}

function delimiterLabel(key) {
  return DELIMITER_OPTIONS.find(option => option.value === key)?.label || key;
}
