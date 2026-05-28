const DEFAULT_INDENT = 2;
const FORMAT_MODE = 'format';
const MINIFY_MODE = 'minify';

export function processJson(input, options = {}) {
  const rawInput = String(input ?? '');
  const parsed = parseJsonInput(rawInput);
  const sorted = Boolean(options.sortKeys);
  const value = sorted ? sortJsonKeys(parsed) : parsed;
  const mode = normaliseMode(options.mode);
  const indent = normaliseIndent(options.indent);
  const output = mode === MINIFY_MODE
    ? JSON.stringify(value)
    : JSON.stringify(value, null, indent);
  const stats = analyseJsonValue(value);
  const inputBytes = countUtf8Bytes(rawInput);
  const outputBytes = countUtf8Bytes(output);

  return {
    mode,
    indent,
    sorted,
    output,
    outputType: mode === MINIFY_MODE ? 'Minified JSON' : 'Formatted JSON',
    stats: {
      ...stats,
      inputBytes,
      outputBytes,
      inputSizeLabel: formatByteSize(inputBytes),
      outputSizeLabel: formatByteSize(outputBytes)
    }
  };
}

export function parseJsonInput(input) {
  const rawInput = String(input ?? '');

  if (!rawInput.trim()) {
    throw createJsonError('Enter JSON input.', {
      originalMessage: 'Empty input',
      line: null,
      column: null,
      position: null,
      snippet: ''
    });
  }

  try {
    return JSON.parse(rawInput);
  } catch (error) {
    const details = getJsonParseErrorDetails(rawInput, error);
    const message = details.line && details.column
      ? `JSON parse error at line ${details.line}, column ${details.column}: ${details.originalMessage}`
      : `JSON parse error: ${details.originalMessage}`;

    throw createJsonError(message, details);
  }
}

export function sortJsonKeys(value) {
  if (Array.isArray(value)) {
    return value.map(item => sortJsonKeys(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en-GB'))
      .reduce((result, key) => {
        result[key] = sortJsonKeys(value[key]);
        return result;
      }, {});
  }

  return value;
}

export function analyseJsonValue(value) {
  const stats = {
    rootType: getJsonType(value),
    depth: 0,
    objectCount: 0,
    arrayCount: 0,
    keyCount: 0,
    primitiveCount: 0
  };

  visitJsonValue(value, 1, stats);

  return stats;
}

export function getJsonParseErrorDetails(input, error) {
  const originalMessage = error?.message || 'Unable to parse JSON.';
  const position = extractPosition(originalMessage);
  const explicitLocation = extractLineAndColumn(originalMessage);
  const location = typeof position === 'number'
    ? getLineColumnFromPosition(input, position)
    : explicitLocation;
  const snippet = location.line && location.column
    ? buildErrorSnippet(input, location.line, location.column)
    : '';

  return {
    originalMessage,
    position,
    line: location.line,
    column: location.column,
    snippet
  };
}

export function formatByteSize(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024) {
    return `${value.toLocaleString('en-GB')} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let unitIndex = -1;
  let size = value;

  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);

  return `${size.toLocaleString('en-GB', {
    maximumFractionDigits: size >= 10 ? 1 : 2
  })} ${units[unitIndex]}`;
}

function visitJsonValue(value, depth, stats) {
  stats.depth = Math.max(stats.depth, depth);

  if (Array.isArray(value)) {
    stats.arrayCount += 1;
    value.forEach(item => visitJsonValue(item, depth + 1, stats));
    return;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    stats.objectCount += 1;
    stats.keyCount += keys.length;
    keys.forEach(key => visitJsonValue(value[key], depth + 1, stats));
    return;
  }

  stats.primitiveCount += 1;
}

function getJsonType(value) {
  if (Array.isArray(value)) {
    return 'Array';
  }

  if (value === null) {
    return 'Null';
  }

  if (typeof value === 'object') {
    return 'Object';
  }

  if (typeof value === 'string') {
    return 'String';
  }

  if (typeof value === 'number') {
    return 'Number';
  }

  if (typeof value === 'boolean') {
    return 'Boolean';
  }

  return 'Unknown';
}

function normaliseMode(value) {
  return value === MINIFY_MODE ? MINIFY_MODE : FORMAT_MODE;
}

function normaliseIndent(value) {
  const indent = Number(value);
  return [2, 4].includes(indent) ? indent : DEFAULT_INDENT;
}

function countUtf8Bytes(value) {
  return new TextEncoder().encode(String(value)).length;
}

function extractPosition(message) {
  const match = String(message).match(/position\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractLineAndColumn(message) {
  const match = String(message).match(/line\s+(\d+)\s+column\s+(\d+)/i);

  if (!match) {
    return {
      line: null,
      column: null
    };
  }

  return {
    line: Number(match[1]),
    column: Number(match[2])
  };
}

function getLineColumnFromPosition(input, position) {
  let line = 1;
  let column = 1;
  const limit = Math.max(0, Math.min(position, input.length));

  for (let index = 0; index < limit; index += 1) {
    if (input[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return {
    line,
    column
  };
}

function buildErrorSnippet(input, line, column) {
  const lines = String(input).split(/\r?\n/);
  const lineText = lines[line - 1] || '';
  const pointer = `${' '.repeat(Math.max(column - 1, 0))}^`;

  return `${lineText}\n${pointer}`;
}

function createJsonError(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}
