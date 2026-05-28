import { formatByteSize } from './json-formatter.js';

export const URL_TOOL_MODES = [
  {
    value: 'encode-component',
    label: 'Encode component'
  },
  {
    value: 'decode-component',
    label: 'Decode component'
  },
  {
    value: 'encode-url',
    label: 'Encode full URL'
  },
  {
    value: 'decode-url',
    label: 'Decode full URL'
  },
  {
    value: 'parse-query',
    label: 'Parse query string'
  },
  {
    value: 'build-query',
    label: 'Build query string'
  }
];

const DEFAULT_MODE = 'encode-component';
const JSON_OUTPUT = 'json';
const MARKDOWN_OUTPUT = 'markdown';

export function processUrlTool(options = {}) {
  const mode = normaliseMode(options.mode);
  const input = String(options.input ?? '');
  let result;

  if (mode === 'encode-component') {
    result = createTextResult({
      mode,
      output: encodeComponent(input),
      outputType: 'Encoded component',
      warnings: []
    });
  }

  if (mode === 'decode-component') {
    result = createTextResult({
      mode,
      output: decodeComponent(input),
      outputType: 'Decoded component',
      warnings: buildDecodeWarnings(input)
    });
  }

  if (mode === 'encode-url') {
    result = createTextResult({
      mode,
      output: encodeFullUrl(input),
      outputType: 'Encoded URL',
      warnings: []
    });
  }

  if (mode === 'decode-url') {
    result = createTextResult({
      mode,
      output: decodeFullUrl(input),
      outputType: 'Decoded URL',
      warnings: buildDecodeWarnings(input)
    });
  }

  if (mode === 'parse-query') {
    const entries = parseQueryString(input);
    const outputFormat = normaliseOutputFormat(options.outputFormat);
    const output = outputFormat === MARKDOWN_OUTPUT ? formatEntriesAsMarkdown(entries) : formatEntriesAsJson(entries);

    result = createTextResult({
      mode,
      output,
      outputType: outputFormat === MARKDOWN_OUTPUT ? 'Markdown table' : 'JSON query entries',
      itemCount: entries.length,
      warnings: buildEntryWarnings(entries)
    });
  }

  if (mode === 'build-query') {
    const entries = parseKeyValueRows(input);
    const output = buildQueryString(entries, {
      includeQuestionMark: options.includeQuestionMark,
      sortKeys: options.sortKeys
    });

    result = createTextResult({
      mode,
      output,
      outputType: 'Query string',
      itemCount: entries.length,
      warnings: buildEntryWarnings(entries)
    });
  }

  return result;
}

export function encodeComponent(value) {
  const input = requireInput(value, 'Enter text to encode.');
  return wrapUriError(() => encodeURIComponent(input), 'Unable to encode this URL component.');
}

export function decodeComponent(value) {
  const input = requireInput(value, 'Enter text to decode.');
  assertValidPercentEncoding(input);
  return wrapUriError(() => decodeURIComponent(input), 'Unable to decode this URL component.');
}

export function encodeFullUrl(value) {
  const input = requireInput(value, 'Enter a URL to encode.');
  return wrapUriError(() => encodeURI(input), 'Unable to encode this URL.');
}

export function decodeFullUrl(value) {
  const input = requireInput(value, 'Enter a URL to decode.');
  assertValidPercentEncoding(input);
  return wrapUriError(() => decodeURI(input), 'Unable to decode this URL.');
}

export function parseQueryString(value) {
  const query = extractQueryString(requireInput(value, 'Enter a query string or URL.'));

  if (!query) {
    return [];
  }

  assertValidPercentEncoding(query);

  return query
    .split('&')
    .filter(part => part.length > 0)
    .map(part => {
      const separatorIndex = part.indexOf('=');
      const rawKey = separatorIndex === -1 ? part : part.slice(0, separatorIndex);
      const rawValue = separatorIndex === -1 ? '' : part.slice(separatorIndex + 1);

      return {
        key: decodeQueryComponent(rawKey),
        value: decodeQueryComponent(rawValue)
      };
    });
}

export function parseKeyValueRows(value) {
  const input = requireInput(value, 'Enter key=value pairs to build a query string.');
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        throw new Error(`Line ${index + 1} must use key=value format.`);
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (!key) {
        throw new Error(`Line ${index + 1} needs a key.`);
      }

      return {
        key,
        value
      };
    });
}

export function buildQueryString(entries, options = {}) {
  const rows = [...entries];

  if (options.sortKeys) {
    rows.sort((left, right) => {
      const keyComparison = left.key.localeCompare(right.key, 'en-GB');
      return keyComparison || left.value.localeCompare(right.value, 'en-GB');
    });
  }

  const query = rows
    .map(entry => `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`)
    .join('&');

  return options.includeQuestionMark ? `?${query}` : query;
}

export function formatEntriesAsJson(entries) {
  return JSON.stringify(entries, null, 2);
}

export function formatEntriesAsMarkdown(entries) {
  if (entries.length === 0) {
    return '| Key | Value |\n| --- | --- |\n| | |';
  }

  return [
    '| Key | Value |',
    '| --- | --- |',
    ...entries.map(entry => `| ${escapeMarkdownCell(entry.key)} | ${escapeMarkdownCell(entry.value)} |`)
  ].join('\n');
}

export function extractQueryString(value) {
  const input = String(value || '').trim();

  if (!input) {
    return '';
  }

  const questionIndex = input.indexOf('?');

  if (questionIndex !== -1) {
    const hashIndex = input.indexOf('#', questionIndex);
    return input.slice(questionIndex + 1, hashIndex === -1 ? undefined : hashIndex);
  }

  const hashIndex = input.indexOf('#');
  const query = hashIndex === -1 ? input : input.slice(0, hashIndex);
  return query.replace(/^\?/, '');
}

export function assertValidPercentEncoding(value) {
  const input = String(value || '');
  const invalidMatch = input.match(/%(?![0-9A-Fa-f]{2})/);

  if (invalidMatch) {
    throw new Error(`Invalid percent-encoding at character ${invalidMatch.index + 1}.`);
  }
}

function decodeQueryComponent(value) {
  return wrapUriError(
    () => decodeURIComponent(String(value).replace(/\+/g, ' ')),
    'Unable to decode this query string.'
  );
}

function buildDecodeWarnings(input) {
  return String(input).includes('+')
    ? ['Query strings often use + for spaces; use Parse query string when decoding query parameters.']
    : [];
}

function buildEntryWarnings(entries) {
  const warnings = [];
  const counts = entries.reduce((result, entry) => {
    result.set(entry.key, (result.get(entry.key) || 0) + 1);
    return result;
  }, new Map());
  const duplicateKeys = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const emptyValueCount = entries.filter(entry => entry.value === '').length;

  if (duplicateKeys.length > 0) {
    warnings.push(`Duplicate keys found: ${duplicateKeys.join(', ')}.`);
  }

  if (emptyValueCount > 0) {
    warnings.push(`${emptyValueCount.toLocaleString('en-GB')} parameter${emptyValueCount === 1 ? ' has' : 's have'} an empty value.`);
  }

  return warnings;
}

function createTextResult(result) {
  const outputBytes = new TextEncoder().encode(result.output).length;

  return {
    itemCount: result.itemCount ?? 1,
    warnings: result.warnings,
    ...result,
    outputBytes,
    outputSizeLabel: formatByteSize(outputBytes)
  };
}

function normaliseMode(value) {
  return URL_TOOL_MODES.some(mode => mode.value === value) ? value : DEFAULT_MODE;
}

function normaliseOutputFormat(value) {
  return value === MARKDOWN_OUTPUT ? MARKDOWN_OUTPUT : JSON_OUTPUT;
}

function requireInput(value, message) {
  const input = String(value ?? '');

  if (!input.trim()) {
    throw new Error(message);
  }

  return input;
}

function wrapUriError(action, message) {
  try {
    return action();
  } catch (error) {
    if (error instanceof URIError) {
      throw new Error(message);
    }

    throw error;
  }
}

function escapeMarkdownCell(value) {
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}
